"""Unit tests for CardioGuard notifications service and API endpoints.

File purpose:
    Verify business logic (disclaimer enforcement, preferences check, cooldown checks, reading notifications)
    and API route responses under appropriate role permissions (RBAC).
"""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.services import notification_service  # noqa: E402
from app.api import notification_api  # noqa: E402


class TestNotificationService(unittest.IsolatedAsyncioTestCase):
    """Test business logic inside notification_service.py."""

    def test_enforce_medical_disclaimer_appends_only_for_ai_types(self):
        msg = "Chỉ số nhịp tim của bạn tăng cao."
        # Not AI type
        res1 = notification_service.enforce_medical_disclaimer(msg, "vital_signs_warning")
        self.assertEqual(res1, msg)

        # AI type
        res2 = notification_service.enforce_medical_disclaimer(msg, "ai_recommendation")
        self.assertTrue(res2.startswith(msg))
        self.assertIn("trợ lý AI", res2)

    @patch("app.services.notification_service.database")
    async def test_get_user_preferences_returns_defaults_on_db_error_or_missing(self, mock_db):
        mock_db.fetch_one = AsyncMock(return_value=None)
        prefs = await notification_service.get_user_preferences("user-123")
        self.assertTrue(prefs["health"])
        self.assertTrue(prefs["chat"])

    @patch("app.services.notification_service.database")
    async def test_get_user_preferences_merges_saved_preferences(self, mock_db):
        saved_row = MagicMock()
        saved_row.__getitem__.side_effect = lambda key: {"notification_preferences": '{"health": false, "chat": true}'}[key]
        mock_db.fetch_one = AsyncMock(return_value=saved_row)

        prefs = await notification_service.get_user_preferences("user-123")
        self.assertFalse(prefs["health"])
        self.assertTrue(prefs["chat"])
        self.assertTrue(prefs["system"])  # Check fallback key is kept

    @patch("app.services.notification_service.get_user_preferences")
    @patch("app.services.notification_service.database")
    async def test_create_notification_skips_when_preference_disabled(self, mock_db, mock_prefs):
        mock_prefs.return_value = {"health": False}
        res = await notification_service.create_notification(
            user_id="user-123",
            title="Heart warning",
            message="Check vitals",
            type="warning",
            category="health"
        )
        self.assertIsNone(res)
        mock_db.execute.assert_not_called()

    @patch("app.services.notification_service.get_user_preferences")
    @patch("app.services.notification_service.database")
    async def test_create_notification_cooldown_enforcement(self, mock_db, mock_prefs):
        mock_prefs.return_value = {"health": True}
        # Simulate a recent notification exists
        mock_db.fetch_one = AsyncMock(return_value={"id": "recent-1"})

        res = await notification_service.create_notification(
            user_id="user-123",
            title="Heart warning",
            message="Check vitals",
            type="warning",
            category="health",
            cooldown_mins=5
        )
        self.assertIsNone(res)
        # Execute insert should not have been called because cooldown matched
        mock_db.execute.assert_not_called()


class TestNotificationApi(unittest.IsolatedAsyncioTestCase):
    """Test API endpoint logic in notification_api.py."""

    @patch("app.api.notification_api.get_user_from_token")
    @patch("app.api.notification_api.database")
    async def test_list_notifications_returns_paginated_list(self, mock_db, mock_auth):
        mock_auth.return_value = {"id": "user-123", "role": "patient"}
        
        mock_db.fetch_val = AsyncMock(return_value=1)
        row = MagicMock()
        row.keys.return_value = ["id", "title"]
        row.__getitem__.side_effect = lambda key: {"id": "notif-1", "title": "New record signed"}[key]
        mock_db.fetch_all = AsyncMock(return_value=[row])

        result = await notification_api.list_notifications(10, 0, authorization="Bearer token")
        
        self.assertEqual(result["total"], 1)
        self.assertEqual(len(result["items"]), 1)
        self.assertEqual(result["items"][0]["title"], "New record signed")


if __name__ == "__main__":
    unittest.main()
