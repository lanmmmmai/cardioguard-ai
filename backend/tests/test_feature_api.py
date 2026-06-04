"""Unit tests for feature_api.py — dashboard summary and AI health analysis.

Run: python -m unittest tests.test_feature_api
"""

import os, sys, unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")


class TestDashboardSummary(unittest.IsolatedAsyncioTestCase):
    """Tests for dashboard_summary endpoint."""

    @patch("app.api.feature_api.get_user_from_token")
    async def test_dashboard_summary_returns_modules(self, mock_get_user):
        from app.api.feature_api import dashboard_summary
        mock_get_user.return_value = {"id": "user-1", "role": "patient"}

        result = await dashboard_summary(authorization="Bearer token")
        self.assertEqual(result["status"], "running")
        self.assertIn("modules", result)
        self.assertIn("ai_disclaimer", result)
        self.assertIsInstance(result["modules"], list)

    @patch("app.api.feature_api.get_user_from_token")
    async def test_dashboard_summary_any_role_allowed(self, mock_get_user):
        from app.api.feature_api import dashboard_summary
        mock_get_user.return_value = {"id": "admin-1", "role": "admin"}

        result = await dashboard_summary(authorization="Bearer token")
        self.assertEqual(result["status"], "running")


class TestHealthAnalysis(unittest.IsolatedAsyncioTestCase):
    """Tests for health_analysis endpoint."""

    @patch("app.api.feature_api.get_user_from_token")
    async def test_admin_can_access(self, mock_get_user):
        from app.api.feature_api import health_analysis
        mock_get_user.return_value = {"id": "admin-1", "role": "admin"}

        result = await health_analysis(
            payload={"heart_rate": 72},
            authorization="Bearer token",
        )
        self.assertIn("risk_level", result)
        self.assertIn("summary", result)

    @patch("app.api.feature_api.get_user_from_token")
    async def test_doctor_can_access(self, mock_get_user):
        from app.api.feature_api import health_analysis
        mock_get_user.return_value = {"id": "doctor-1", "role": "doctor"}

        result = await health_analysis(
            payload={"spo2": 95},
            authorization="Bearer token",
        )
        self.assertIn("risk_level", result)

    @patch("app.api.feature_api.get_user_from_token")
    async def test_patient_denied(self, mock_get_user):
        from app.api.feature_api import health_analysis
        from fastapi import HTTPException
        mock_get_user.return_value = {"id": "patient-1", "role": "patient"}

        with self.assertRaises(HTTPException):
            await health_analysis(
                payload={"heart_rate": 72},
                authorization="Bearer token",
            )


if __name__ == "__main__":
    unittest.main()
