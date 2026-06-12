import os, sys, unittest
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from fastapi import HTTPException
from datetime import datetime, timezone


class TestHelpers(unittest.TestCase):
    def test_chat_table_name_valid(self):
        from app.api.chat_api import chat_table_name, CHAT_SESSIONS_TABLE, CHAT_MESSAGES_TABLE
        self.assertEqual(chat_table_name(CHAT_SESSIONS_TABLE), "chat_sessions")
        self.assertEqual(chat_table_name(CHAT_MESSAGES_TABLE), "chatbot_messages")

    def test_chat_table_name_invalid(self):
        from app.api.chat_api import chat_table_name
        with self.assertRaises(RuntimeError):
            chat_table_name("hack; DROP TABLE")

    def test_normalize_chat_role(self):
        from app.api.chat_api import normalize_chat_role
        self.assertEqual(normalize_chat_role("Patient"), "patient")
        self.assertEqual(normalize_chat_role("DOCTOR"), "doctor")

    def test_normalize_chat_role_invalid(self):
        from app.api.chat_api import normalize_chat_role
        with self.assertRaises(HTTPException) as ctx:
            normalize_chat_role("admin")
        self.assertEqual(ctx.exception.status_code, 422)

    def test_to_utc_isoformat_naive(self):
        from app.api.chat_api import to_utc_isoformat
        d = datetime(2026, 1, 1, 12, 0, 0)
        result = to_utc_isoformat(d)
        self.assertIn("+00:00", result)

    def test_to_utc_isoformat_aware(self):
        from app.api.chat_api import to_utc_isoformat
        d = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = to_utc_isoformat(d)
        self.assertIn("+00:00", result)


class TestEnforceChatRole(unittest.TestCase):
    def test_admin_allowed_any(self):
        from app.api.chat_api import enforce_chat_role
        enforce_chat_role({"id": "a1", "role": "admin"}, "patient")
        enforce_chat_role({"id": "a1", "role": "admin"}, "doctor")

    def test_patient_only_patient(self):
        from app.api.chat_api import enforce_chat_role
        with self.assertRaises(HTTPException) as ctx:
            enforce_chat_role({"id": "p1", "role": "patient"}, "doctor")
        self.assertEqual(ctx.exception.status_code, 403)

    def test_doctor_allowed_doctor(self):
        from app.api.chat_api import enforce_chat_role
        enforce_chat_role({"id": "d1", "role": "doctor"}, "doctor")


class TestSendChatMessage(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    @patch("app.api.chat_api.ai_service")
    async def test_new_session(self, mock_ai, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_ai.generate_chat_response = AsyncMock(return_value="Hello! How can I help?")

        async def fake_fetch_one(*args, **kwargs):
            q = args[0] if args else kwargs.get("query", "")
            if "RETURNING id" in q and "chat_sessions" in q:
                return {"id": "session-uuid"}
            if "RETURNING id" in q:
                return {"id": "msg-uuid", "created_at": datetime.now(timezone.utc)}
            return None

        mock_db.fetch_one = AsyncMock(side_effect=fake_fetch_one)
        mock_db.fetch_all = AsyncMock(return_value=[])
        mock_db.execute = AsyncMock()

        from app.api.chat_api import send_chat_message, ChatMessageRequest
        req = ChatMessageRequest(message="Hello")
        result = await send_chat_message(req, authorization="Bearer token")
        self.assertIn("session_id", result)
        self.assertEqual(result["ai_message"]["sender"], "ai")

    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    @patch("app.api.chat_api.ai_service")
    async def test_existing_session(self, mock_ai, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_ai.generate_chat_response = AsyncMock(return_value="Follow-up response")

        call_count = [0]

        async def fake_fetch_one(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return {"1": 1}
            return {"id": "msg-uuid", "created_at": datetime.now(timezone.utc)}

        mock_db.fetch_one = AsyncMock(side_effect=fake_fetch_one)
        mock_db.fetch_all = AsyncMock(return_value=[
            {"sender": "user", "message": "Hi"},
            {"sender": "ai", "message": "Hello"},
        ])
        mock_db.execute = AsyncMock()

        from app.api.chat_api import send_chat_message, ChatMessageRequest
        req = ChatMessageRequest(message="How are you?", session_id="existing-session")
        result = await send_chat_message(req, authorization="Bearer token")
        self.assertEqual(result["ai_message"]["message"], "Follow-up response")


class TestGetChatSessions(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    async def test_patient_sessions(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_db.fetch_all = AsyncMock(return_value=[
            {"id": "s1", "title": "Session 1", "created_at": datetime.now(timezone.utc)},
        ])
        from app.api.chat_api import get_chat_sessions
        result = await get_chat_sessions(authorization="Bearer token")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].id, "s1")


class TestGetChatHistory(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    async def test_full_history(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_db.fetch_one = AsyncMock(return_value={"1": 1})
        mock_db.fetch_all = AsyncMock(return_value=[
            {"id": "m1", "sender": "user", "message": "Hi", "created_at": datetime.now(timezone.utc)},
            {"id": "m2", "sender": "ai", "message": "Hello", "created_at": datetime.now(timezone.utc)},
        ])
        from app.api.chat_api import get_chat_history
        result = await get_chat_history("session-uuid", authorization="Bearer token")
        self.assertEqual(len(result), 2)


class TestAnalyzePatient(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    @patch("app.api.chat_api.ai_service")
    async def test_doctor_analyze(self, mock_ai, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "d1", "role": "doctor"}
        mock_db.fetch_one = AsyncMock(return_value={"1": 1})
        mock_db.fetch_all = AsyncMock(return_value=[])
        mock_ai.analyze_patient_data = AsyncMock(return_value="Patient is stable.")

        from app.api.chat_api import analyze_patient
        result = await analyze_patient(patient_id="p1", authorization="Bearer token")
        self.assertIn("insight", result)

    @patch("app.api.chat_api.get_user_from_token")
    async def test_patient_denied(self, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        from app.api.chat_api import analyze_patient
        with self.assertRaises(HTTPException) as ctx:
            await analyze_patient(patient_id="p1", authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)


class TestGetRecommendations(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    async def test_patient_own(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_db.fetch_all = AsyncMock(return_value=[{
            "id": "r1", "severity": "low", "recommendation": "Stay hydrated", "created_at": None,
        }])
        from app.api.chat_api import get_recommendations
        result = await get_recommendations(authorization="Bearer token", patient_id=None)
        self.assertEqual(len(result), 1)

    @patch("app.api.chat_api.get_user_from_token")
    async def test_patient_other_denied(self, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        from app.api.chat_api import get_recommendations
        with self.assertRaises(HTTPException) as ctx:
            await get_recommendations(patient_id="p2", authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    async def test_admin_all(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "a1", "role": "admin"}
        mock_db.fetch_all = AsyncMock(return_value=[])
        from app.api.chat_api import get_recommendations
        result = await get_recommendations(authorization="Bearer token", patient_id=None)
        self.assertEqual(result, [])

    @patch("app.api.chat_api.get_user_from_token")
    @patch("app.api.chat_api.database")
    async def test_doctor_assigned(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "d1", "role": "doctor"}
        mock_db.fetch_all = AsyncMock(return_value=[{
            "id": "r1", "severity": "medium", "recommendation": "Exercise", "created_at": None,
        }])
        from app.api.chat_api import get_recommendations
        result = await get_recommendations(authorization="Bearer token", patient_id=None)
        self.assertEqual(len(result), 1)


if __name__ == "__main__":
    unittest.main()
