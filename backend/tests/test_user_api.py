import os, sys, unittest, types
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from fastapi import HTTPException
import app.api.user_api as user_api_module

MOCK_USER_COLUMNS = {"id", "full_name", "email", "phone", "role", "status", "created_at", "avatar_url", "updated_at"}
MOCK_PATIENT_COLUMNS = {"id", "full_name", "age", "gender", "phone", "address", "medical_history", "created_at", "user_id"}
MOCK_AUDIT_COLUMNS = {"id", "user_id", "action", "entity_type", "entity_id", "details", "ip_address", "created_at"}

GENERIC_PATIENT_USER = {"id": "patient-uuid", "full_name": "Test Patient", "email": "p@t.com",
    "phone": "0123", "role": "patient", "created_at": None, "status": "active", "avatar_url": None}


class TestTableColumns(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        user_api_module._column_cache.clear()

    @patch("app.api.user_api.database")
    async def test_returns_columns(self, mock_db):
        mock_db.fetch_all = AsyncMock(return_value=[{"column_name": "id"}, {"column_name": "name"}])
        result = await user_api_module.table_columns("users")
        self.assertEqual(result, {"id", "name"})

    @patch("app.api.user_api.database")
    async def test_empty_raises_500(self, mock_db):
        mock_db.fetch_all = AsyncMock(return_value=[])
        with self.assertRaises(HTTPException) as ctx:
            await user_api_module.table_columns("ghost_table")
        self.assertEqual(ctx.exception.status_code, 500)


class TestRowToDict(unittest.TestCase):
    def test_none(self):
        self.assertIsNone(user_api_module.row_to_dict(None))

    def test_basic_dict(self):
        from datetime import datetime, timezone
        d = user_api_module.row_to_dict({"id": "1", "name": "A"})
        self.assertEqual(d["id"], "1")

    def test_datetime_conversion(self):
        from datetime import datetime, timezone
        d = user_api_module.row_to_dict({"dt": datetime(2026, 1, 1, tzinfo=timezone.utc)})
        self.assertEqual(d["dt"], "2026-01-01T00:00:00+00:00")

    def test_naive_datetime(self):
        from datetime import datetime
        d = user_api_module.row_to_dict({"dt": datetime(2026, 1, 1)})
        self.assertIn("+00:00", d["dt"])


class TestRequireAdmin(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.user_api.get_user_from_token")
    async def test_admin_allowed(self, mock_get_user):
        mock_get_user.return_value = {"id": "admin-uuid", "role": "admin"}
        result = await user_api_module.require_admin("Bearer token")
        self.assertEqual(result["id"], "admin-uuid")

    @patch("app.api.user_api.get_user_from_token")
    async def test_non_admin_denied(self, mock_get_user):
        mock_get_user.return_value = {"id": "user-uuid", "role": "patient"}
        with self.assertRaises(HTTPException) as ctx:
            await user_api_module.require_admin("Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)


class TestFetchCurrentUser(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.user_api.table_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.user_api.database")
    async def test_found(self, mock_db, mock_cols):
        mock_db.fetch_one = AsyncMock(return_value={"id": "u1", "full_name": "A", "email": "a@a.com",
            "phone": "012", "role": "patient", "created_at": None, "status": "active", "avatar_url": None})
        result = await user_api_module.fetch_current_user("u1")
        self.assertEqual(result["id"], "u1")

    @patch("app.api.user_api.table_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.user_api.database")
    async def test_not_found(self, mock_db, mock_cols):
        mock_db.fetch_one = AsyncMock(return_value=None)
        with self.assertRaises(HTTPException) as ctx:
            await user_api_module.fetch_current_user("u1")
        self.assertEqual(ctx.exception.status_code, 404)


class TestUpdateUserMe(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.table_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.user_api.database")
    @patch("app.api.user_api.log_activity")
    async def test_update_success(self, mock_log, mock_db, mock_cols, mock_get_user):
        mock_get_user.return_value = {"id": "u1", "role": "patient"}
        mock_log.return_value = None
        mock_db.execute = AsyncMock()
        mock_db.fetch_one = AsyncMock(return_value={"id": "u1", "full_name": "New Name", "email": "a@a.com",
            "phone": "0999", "role": "patient", "created_at": None, "status": "active", "avatar_url": None})

        from app.api.user_api import update_user_me, UserMeUpdate
        payload = UserMeUpdate(full_name="New Name")
        result = await update_user_me(payload, self.mock_request, authorization="Bearer token")
        self.assertIn("user", result)
        self.assertEqual(result["user"]["full_name"], "New Name")

    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.table_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.user_api.database")
    async def test_no_update_values(self, mock_db, mock_cols, mock_get_user):
        mock_get_user.return_value = {"id": "u1", "role": "patient"}
        mock_db.fetch_one = AsyncMock(return_value={"id": "u1", "full_name": "Same", "email": "a@a.com",
            "phone": None, "role": "patient", "created_at": None, "status": "active", "avatar_url": None})

        from app.api.user_api import update_user_me, UserMeUpdate
        payload = UserMeUpdate()
        result = await update_user_me(payload, self.mock_request, authorization="Bearer token")
        self.assertIn("user", result)


class TestUpdateUserPassword(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.database")
    @patch("app.api.user_api.verify_password")
    @patch("app.api.user_api.hash_password")
    @patch("app.api.user_api.log_activity")
    async def test_success(self, mock_log, mock_hash, mock_verify, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "u1", "role": "patient"}
        mock_verify.return_value = True
        mock_hash.return_value = "new_hash"
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={"password_hash": "oldhash"})
        mock_db.execute = AsyncMock()

        from app.api.user_api import update_user_password, PasswordUpdate
        payload = PasswordUpdate(current_password="old", new_password="NewStr@ng1!", confirm_password="NewStr@ng1!")
        result = await update_user_password(payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(result["message"], "Password updated successfully")

    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.database")
    @patch("app.api.user_api.verify_password")
    async def test_wrong_password(self, mock_verify, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "u1", "role": "patient"}
        mock_verify.return_value = False
        mock_db.fetch_one = AsyncMock(return_value={"password_hash": "oldhash"})

        from app.api.user_api import update_user_password, PasswordUpdate
        payload = PasswordUpdate(current_password="wrong", new_password="NewStr@ng1!", confirm_password="NewStr@ng1!")
        with self.assertRaises(HTTPException) as ctx:
            await update_user_password(payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)


class TestGetPatientMe(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.fetch_patient_profile")
    async def test_patient_own_profile(self, mock_fetch, mock_get_user):
        mock_get_user.return_value = {"id": "patient-uuid", "role": "patient"}
        mock_fetch.return_value = {"id": "patient-uuid", "full_name": "Test"}
        from app.api.user_api import get_patient_me
        result = await get_patient_me(authorization="Bearer token")
        self.assertEqual(result["patient"]["id"], "patient-uuid")

    @patch("app.api.user_api.get_user_from_token")
    async def test_non_patient_denied(self, mock_get_user):
        mock_get_user.return_value = {"id": "admin-uuid", "role": "admin"}
        from app.api.user_api import get_patient_me
        with self.assertRaises(HTTPException) as ctx:
            await get_patient_me(authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.fetch_patient_profile")
    async def test_no_profile(self, mock_fetch, mock_get_user):
        mock_get_user.return_value = {"id": "patient-uuid", "role": "patient"}
        mock_fetch.return_value = None
        from app.api.user_api import get_patient_me
        result = await get_patient_me(authorization="Bearer token")
        self.assertIsNone(result["patient"])


class TestUpdatePatientMe(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.table_columns", return_value=MOCK_PATIENT_COLUMNS)
    @patch("app.api.user_api.database")
    @patch("app.api.user_api.log_activity")
    async def test_update_existing(self, mock_log, mock_db, mock_cols, mock_get_user):
        mock_get_user.return_value = {"id": "patient-uuid", "role": "patient", "full_name": "Test Patient"}
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={"id": "patient-uuid", "full_name": "Updated",
            "age": 30, "gender": "Nam", "phone": "0999", "address": "HN", "medical_history": "", "created_at": None})
        mock_db.execute = AsyncMock()

        from app.api.user_api import update_patient_me, PatientMeUpdate
        payload = PatientMeUpdate(age=30)
        result = await update_patient_me(payload, self.mock_request, authorization="Bearer token")
        self.assertIn("patient", result)

    @patch("app.api.user_api.get_user_from_token")
    async def test_non_patient_denied(self, mock_get_user):
        mock_get_user.return_value = {"id": "admin-uuid", "role": "admin"}
        from app.api.user_api import update_patient_me, PatientMeUpdate
        payload = PatientMeUpdate()
        with self.assertRaises(HTTPException) as ctx:
            await update_patient_me(payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)


class TestGetMyDoctors(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.user_api.get_user_from_token")
    @patch("app.api.user_api.database")
    async def test_patient_success(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "patient-uuid", "role": "patient"}
        mock_db.fetch_all = AsyncMock(return_value=[{"id": "doc-uuid", "full_name": "Dr A", "email": "dr@a.com"}])
        from app.api.user_api import get_my_doctors
        result = await get_my_doctors(authorization="Bearer token")
        self.assertEqual(len(result), 1)

    @patch("app.api.user_api.get_user_from_token")
    async def test_non_patient_denied(self, mock_get_user):
        mock_get_user.return_value = {"id": "doctor-uuid", "role": "doctor"}
        from app.api.user_api import get_my_doctors
        with self.assertRaises(HTTPException) as ctx:
            await get_my_doctors(authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)


class TestAssignments(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_get_assignments(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_all = AsyncMock(return_value=[])
        from app.api.user_api import get_assignments
        result = await get_assignments(authorization="Bearer token")
        self.assertEqual(result, [])

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_create_assignment_success(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"id": "doc-uuid"},
            {"id": "patient-uuid"},
            None,
        ])
        mock_db.execute = AsyncMock()

        from app.api.user_api import create_assignment, AssignmentCreate
        payload = AssignmentCreate(doctor_id="doc-uuid", patient_id="patient-uuid")
        result = await create_assignment(payload, self.mock_request, authorization="Bearer token")
        self.assertIn("Phân công", result["message"])

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_create_assignment_dup(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"id": "doc-uuid"},
            {"id": "patient-uuid"},
            {"1": 1},
        ])

        from app.api.user_api import create_assignment, AssignmentCreate
        payload = AssignmentCreate(doctor_id="doc-uuid", patient_id="patient-uuid")
        with self.assertRaises(HTTPException) as ctx:
            await create_assignment(payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_delete_assignment_success(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_one = AsyncMock(return_value={"1": 1})
        mock_db.execute = AsyncMock()

        from app.api.user_api import delete_assignment
        result = await delete_assignment("doc-uuid", "patient-uuid", self.mock_request, authorization="Bearer token")
        self.assertIn("Hủy phân công", result["message"])

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_delete_assignment_not_found(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_one = AsyncMock(return_value=None)

        from app.api.user_api import delete_assignment
        with self.assertRaises(HTTPException) as ctx:
            await delete_assignment("doc-uuid", "missing-uuid", self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 404)


class TestAdminUsers(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_list_users(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_val = AsyncMock(return_value=1)
        mock_db.fetch_all = AsyncMock(return_value=[{"id": "u1", "full_name": "A", "email": "a@a.com",
            "phone": "012", "role": "patient", "status": "active", "created_at": None}])
        from app.api.user_api import list_users
        result = await list_users(authorization="Bearer token")
        self.assertEqual(result["total"], 1)

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    @patch("app.api.user_api.table_columns", return_value=MOCK_PATIENT_COLUMNS)
    @patch("app.api.user_api.hash_password")
    @patch("app.api.user_api.log_activity")
    async def test_create_user_patient(self, mock_log, mock_hash, mock_cols, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_hash.return_value = "hash"
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(side_effect=lambda q, v: None if "SELECT id" in q else {
            "id": "new-uuid", "full_name": "New User", "email": "n@t.com",
            "phone": "012", "role": "patient", "status": "active", "created_at": None
        })
        mock_db.fetch_all = AsyncMock(return_value=[{"column_name": "user_id"}])
        mock_db.execute = AsyncMock()

        from app.api.user_api import create_user, UserAdminCreate
        payload = UserAdminCreate(full_name="New User", email="n@t.com", password="Str@ng1!", role="patient")
        result = await create_user(payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(result["email"], "n@t.com")

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_create_user_dup_email(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_one = AsyncMock(return_value={"id": "existing-uuid"})

        from app.api.user_api import create_user, UserAdminCreate
        payload = UserAdminCreate(full_name="New User", email="dup@t.com", password="Str@ng1!", role="doctor")
        with self.assertRaises(HTTPException) as ctx:
            await create_user(payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    @patch("app.api.user_api.hash_password")
    @patch("app.api.user_api.log_activity")
    async def test_update_user_success(self, mock_log, mock_hash, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_hash.return_value = "hash"
        mock_log.return_value = None
        call_count = [0]

        async def fake_fetch_one(q, v=None):
            call_count[0] += 1
            if call_count[0] == 1:
                return {"id": "target-uuid", "role": "doctor", "full_name": "Old"}
            if "RETURNING" in q:
                return {"id": "target-uuid", "full_name": "New Name", "email": "old@t.com",
                    "phone": "012", "role": "doctor", "status": "active", "created_at": None}
            return None

        mock_db.fetch_one = AsyncMock(side_effect=fake_fetch_one)
        mock_db.execute = AsyncMock()

        from app.api.user_api import update_user, UserAdminUpdate
        payload = UserAdminUpdate(full_name="New Name")
        result = await update_user("target-uuid", payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(result["full_name"], "New Name")

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_update_user_not_found(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_one = AsyncMock(return_value=None)

        from app.api.user_api import update_user, UserAdminUpdate
        payload = UserAdminUpdate(full_name="New Name")
        with self.assertRaises(HTTPException) as ctx:
            await update_user("missing-uuid", payload, self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 404)

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.table_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.user_api.database")
    @patch("app.api.user_api.log_activity")
    async def test_delete_user_success(self, mock_log, mock_db, mock_cols, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={"id": "target-uuid", "role": "patient", "status": "active"})
        mock_db.execute = AsyncMock()
        mock_db.fetch_all = AsyncMock(return_value=[{"column_name": "id"},
            {"column_name": "status"}, {"column_name": "updated_at"}])

        from app.api.user_api import delete_user
        result = await delete_user("target-uuid", self.mock_request, authorization="Bearer token")
        self.assertIn("vô hiệu hóa", result["message"])
        self.assertEqual(result["status"], "deleted")

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_delete_self_denied(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_one = AsyncMock(return_value={"id": "admin-uuid", "role": "admin", "status": "active"})

        from app.api.user_api import delete_user
        with self.assertRaises(HTTPException) as ctx:
            await delete_user("admin-uuid", self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 400)


class TestAuditLogs(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.table_columns", return_value=MOCK_AUDIT_COLUMNS)
    @patch("app.api.user_api.database")
    async def test_get_audit_logs(self, mock_db, mock_cols, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        from datetime import datetime, timezone
        mock_db.fetch_all = AsyncMock(return_value=[
            {"id": "log-1", "user_id": "u1", "action": "LOGIN", "entity_type": "users",
             "entity_id": "u1", "details": '{"key":"val"}', "ip_address": "127.0.0.1", "created_at": datetime.now(timezone.utc)}
        ])
        from app.api.user_api import get_audit_logs
        result = await get_audit_logs(authorization="Bearer token")
        self.assertEqual(len(result), 1)
        self.assertIsInstance(result[0]["details"], dict)


class TestDbPerformance(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_success(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_all = AsyncMock(return_value=[{"query": "SELECT 1", "calls": 100,
            "total_exec_time_ms": 500.0, "mean_exec_time_ms": 5.0, "rows_processed": 1000}])
        from app.api.user_api import db_performance
        result = await db_performance(authorization="Bearer token")
        self.assertEqual(len(result), 1)

    @patch("app.api.user_api.require_admin")
    @patch("app.api.user_api.database")
    async def test_db_error(self, mock_db, mock_admin):
        mock_admin.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_db.fetch_all = AsyncMock(side_effect=Exception("pg_stat_statements not available"))
        from app.api.user_api import db_performance
        with self.assertRaises(HTTPException) as ctx:
            await db_performance(authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 500)


if __name__ == "__main__":
    unittest.main()
