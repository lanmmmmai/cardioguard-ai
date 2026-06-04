import os, sys, unittest, types
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

import app.api.auth_api as auth_api_module

from fastapi import HTTPException
from app.api.auth_api import (
    VALID_ROLES, normalize_role, extract_bearer_token, generic_forgot_password_response,
    get_user_from_token,
)

MOCK_USER_COLUMNS = {
    "id", "full_name", "email", "password_hash", "role",
    "must_change_password", "status", "profile_completed",
    "is_verified", "avatar_url", "google_id", "phone",
    "specialty", "department", "created_at",
}


class TestNormalizeRole(unittest.TestCase):
    def test_valid_roles(self):
        for r in ("admin", "doctor", "patient"):
            self.assertEqual(normalize_role(r), r)

    def test_case_insensitive(self):
        self.assertEqual(normalize_role("Admin"), "admin")
        self.assertEqual(normalize_role("DOCTOR"), "doctor")

    def test_none_raises(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_role(None)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_invalid_role_raises(self):
        with self.assertRaises(HTTPException) as ctx:
            normalize_role("superadmin")
        self.assertEqual(ctx.exception.status_code, 403)


class TestExtractBearerToken(unittest.TestCase):
    def test_valid_token(self):
        self.assertEqual(extract_bearer_token("Bearer mytoken123"), "mytoken123")

    def test_missing_header(self):
        with self.assertRaises(HTTPException) as ctx:
            extract_bearer_token(None)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_not_bearer(self):
        with self.assertRaises(HTTPException) as ctx:
            extract_bearer_token("Basic abc")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_empty(self):
        with self.assertRaises(HTTPException):
            extract_bearer_token("")


class TestGenericForgotPasswordResponse(unittest.TestCase):
    @patch("app.api.auth_api.settings")
    def test_with_brevo(self, mock_settings):
        mock_settings.BREVO_API_KEY = "key"
        r = generic_forgot_password_response("a@b.com")
        self.assertTrue(r["email_sent"])

    @patch("app.api.auth_api.settings")
    def test_without_brevo(self, mock_settings):
        mock_settings.BREVO_API_KEY = ""
        r = generic_forgot_password_response("a@b.com")
        self.assertFalse(r["email_sent"])


class TestGetUserFromToken(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        auth_api_module._user_cache.clear()

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_valid_token_returns_user(self, mock_jwt_decode, mock_db, mock_cols):
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "jti-1"}
        mock_db.fetch_val = AsyncMock(return_value=None)
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "phone": "0123", "role": "patient", "created_at": None,
            "status": "active", "must_change_password": False,
            "profile_completed": True, "is_verified": True, "avatar_url": None,
        })

        result = await get_user_from_token("Bearer token")
        self.assertEqual(result["id"], "user-1")
        self.assertEqual(result["role"], "patient")

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_revoked_token_raises(self, mock_jwt_decode, mock_db):
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "revoked-jti"}
        mock_db.fetch_val = AsyncMock(return_value=1)

        with self.assertRaises(HTTPException) as ctx:
            await get_user_from_token("Bearer token")
        self.assertEqual(ctx.exception.status_code, 401)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_inactive_user_raises(self, mock_jwt_decode, mock_db, mock_cols):
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "jti-1"}
        mock_db.fetch_val = AsyncMock(return_value=None)
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "phone": None, "role": "patient", "created_at": None,
            "status": "inactive", "must_change_password": False,
            "profile_completed": True, "is_verified": True, "avatar_url": None,
        })

        with self.assertRaises(HTTPException) as ctx:
            await get_user_from_token("Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_must_change_password_raises(self, mock_jwt_decode, mock_db, mock_cols):
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "jti-1"}
        mock_db.fetch_val = AsyncMock(return_value=None)
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "phone": None, "role": "patient", "created_at": None,
            "status": "active", "must_change_password": True,
            "profile_completed": True, "is_verified": True, "avatar_url": None,
        })

        with self.assertRaises(HTTPException) as ctx:
            await get_user_from_token("Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_allow_must_change_password_flag(self, mock_jwt_decode, mock_db, mock_cols):
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "jti-1"}
        mock_db.fetch_val = AsyncMock(return_value=None)
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "phone": None, "role": "patient", "created_at": None,
            "status": "active", "must_change_password": True,
            "profile_completed": True, "is_verified": True, "avatar_url": None,
        })

        result = await get_user_from_token("Bearer token", allow_must_change_password=True)
        self.assertEqual(result["id"], "user-1")

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_unverified_doctor_raises(self, mock_jwt_decode, mock_db, mock_cols):
        mock_jwt_decode.return_value = {"sub": "doc-1", "jti": "jti-1"}
        mock_db.fetch_val = AsyncMock(return_value=None)
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "doc-1", "full_name": "Doctor A", "email": "dr@t.com",
            "phone": None, "role": "doctor", "created_at": None,
            "status": "active", "must_change_password": False,
            "profile_completed": True, "is_verified": False, "avatar_url": None,
        })

        with self.assertRaises(HTTPException) as ctx:
            await get_user_from_token("Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_allow_unverified_flag(self, mock_jwt_decode, mock_db, mock_cols):
        mock_jwt_decode.return_value = {"sub": "doc-1", "jti": "jti-1"}
        mock_db.fetch_val = AsyncMock(return_value=None)
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "doc-1", "full_name": "Doctor A", "email": "dr@t.com",
            "phone": None, "role": "doctor", "created_at": None,
            "status": "active", "must_change_password": False,
            "profile_completed": True, "is_verified": False, "avatar_url": None,
        })

        result = await get_user_from_token("Bearer token", allow_unverified=True)
        self.assertEqual(result["id"], "doc-1")


class TestRegisterFlow(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.create_otp_token")
    @patch("app.api.auth_api.send_register_otp_email")
    async def test_request_register_otp_success(
        self, mock_send_email, mock_create_otp, mock_rate, mock_ip, mock_db
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_create_otp.return_value = "123456"
        mock_send_email.return_value = True
        mock_db.fetch_one = AsyncMock(return_value=None)

        from app.api.auth_api import request_register_otp, RegisterOtpRequest
        data = RegisterOtpRequest(email="new@test.com", full_name="New User", role="patient")
        result = await request_register_otp(data, self.mock_request)

        self.assertEqual(result["message"], "OTP sent to email")
        self.assertEqual(result["email"], "new@test.com")
        self.assertTrue(result["email_sent"])

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    async def test_request_register_otp_dup_email(
        self, mock_rate, mock_ip, mock_db
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_db.fetch_one = AsyncMock(return_value={"id": "existing-uuid"})

        from app.api.auth_api import request_register_otp, RegisterOtpRequest
        data = RegisterOtpRequest(email="existing@test.com", full_name="Existing User")
        with self.assertRaises(HTTPException) as ctx:
            await request_register_otp(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    async def test_request_register_otp_admin_denied(
        self, mock_rate, mock_ip, mock_db
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_db.fetch_one = AsyncMock(return_value=None)

        from app.api.auth_api import request_register_otp, RegisterOtpRequest
        data = RegisterOtpRequest(email="admin@test.com", full_name="Admin User", role="admin")
        with self.assertRaises(HTTPException) as ctx:
            await request_register_otp(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.hash_password")
    @patch("app.api.auth_api.log_activity")
    async def test_register_success(
        self, mock_log, mock_hash, mock_rate, mock_ip, mock_db, mock_cols
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_hash.return_value = "hashed_pw"
        mock_log.return_value = None

        mock_db.fetch_one = AsyncMock(side_effect=[
            None,
            {"id": "new-user-uuid", "full_name": "New User"},
        ])
        mock_db.fetch_all = AsyncMock(return_value=[
            {"column_name": "user_id"}, {"column_name": "phone"},
        ])
        mock_db.execute = AsyncMock()

        from app.api.auth_api import register, RegisterRequest
        mock_otp_result = MagicMock()
        mock_otp_result.is_valid = True
        mock_otp_result.metadata = {"role": "patient", "phone": "0123", "full_name": "New User"}

        with patch("app.api.auth_api.verify_otp_token", return_value=mock_otp_result):
            with patch("app.api.auth_api.invalidate_otp_tokens", AsyncMock()):
                data = RegisterRequest(email="new@test.com", full_name="New User", password="Str@ng1!", otp="123456")
                result = await register(data, self.mock_request)

        self.assertEqual(result["message"], "Register successfully")

    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.get_client_ip")
    async def test_register_invalid_otp(
        self, mock_ip, mock_rate
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_otp_result = MagicMock()
        mock_otp_result.is_valid = False
        mock_otp_result.reason = "invalid"

        from app.api.auth_api import register, RegisterRequest
        with patch("app.api.auth_api.verify_otp_token", return_value=mock_otp_result):
            data = RegisterRequest(email="new@test.com", full_name="New User", password="Str@ng1!", otp="000000")
            with self.assertRaises(HTTPException) as ctx:
                await register(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.get_client_ip")
    async def test_register_expired_otp(
        self, mock_ip, mock_rate
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_otp_result = MagicMock()
        mock_otp_result.is_valid = False
        mock_otp_result.reason = "expired"

        from app.api.auth_api import register, RegisterRequest
        with patch("app.api.auth_api.verify_otp_token", return_value=mock_otp_result):
            data = RegisterRequest(email="new@test.com", full_name="New User", password="Str@ng1!", otp="000000")
            with self.assertRaises(HTTPException) as ctx:
                await register(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("expired", ctx.exception.detail)


GENERIC_USER_DB = {
    "id": "user-1", "full_name": "Test User", "email": "t@t.com",
    "password_hash": "hash", "role": "patient",
    "must_change_password": False, "status": "active",
    "profile_completed": True, "is_verified": True, "avatar_url": None,
}


class TestLogin(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.verify_password")
    @patch("app.api.auth_api.create_access_token")
    @patch("app.api.auth_api.log_activity")
    async def test_login_success(
        self, mock_log, mock_create_token, mock_verify, mock_rate, mock_db, mock_cols
    ):
        mock_verify.return_value = True
        mock_create_token.return_value = "new-jwt-token"
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value=dict(GENERIC_USER_DB))

        from app.api.auth_api import login, LoginRequest
        data = LoginRequest(email="t@t.com", password="pass123")
        result = await login(data, self.mock_request)

        self.assertIn("access_token", result)
        self.assertEqual(result["access_token"], "new-jwt-token")
        self.assertEqual(result["user"]["email"], "t@t.com")

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.log_activity")
    async def test_login_wrong_email(
        self, mock_log, mock_rate, mock_db, mock_cols
    ):
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value=None)

        from app.api.auth_api import login, LoginRequest
        data = LoginRequest(email="unknown@t.com", password="pass123")
        with self.assertRaises(HTTPException) as ctx:
            await login(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 401)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.verify_password")
    @patch("app.api.auth_api.log_activity")
    async def test_login_wrong_password(
        self, mock_log, mock_verify, mock_rate, mock_db, mock_cols
    ):
        mock_verify.return_value = False
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value=dict(GENERIC_USER_DB))

        from app.api.auth_api import login, LoginRequest
        data = LoginRequest(email="t@t.com", password="wrong")
        with self.assertRaises(HTTPException) as ctx:
            await login(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 401)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.verify_password")
    @patch("app.api.auth_api.log_activity")
    async def test_login_inactive(
        self, mock_log, mock_verify, mock_rate, mock_db, mock_cols
    ):
        mock_verify.return_value = True
        mock_log.return_value = None
        user = dict(GENERIC_USER_DB)
        user["status"] = "inactive"
        mock_db.fetch_one = AsyncMock(return_value=user)

        from app.api.auth_api import login, LoginRequest
        data = LoginRequest(email="t@t.com", password="pass123")
        with self.assertRaises(HTTPException) as ctx:
            await login(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.verify_password")
    @patch("app.api.auth_api.log_activity")
    async def test_login_expected_role_mismatch(
        self, mock_log, mock_verify, mock_rate, mock_db, mock_cols
    ):
        mock_verify.return_value = True
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value=dict(GENERIC_USER_DB))

        from app.api.auth_api import login, LoginRequest
        data = LoginRequest(email="t@t.com", password="pass123", expected_role="admin")
        with self.assertRaises(HTTPException) as ctx:
            await login(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 403)


class TestGoogleLogin(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.create_access_token")
    @patch("app.api.auth_api.log_activity")
    async def test_existing_user(
        self, mock_log, mock_create_token, mock_rate, mock_db, mock_cols
    ):
        mock_create_token.return_value = "jwt-token"
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "role": "patient", "must_change_password": False, "status": "active",
            "profile_completed": True, "is_verified": True, "avatar_url": None,
            "google_id": None,
        })
        mock_db.execute = AsyncMock()

        from app.api.auth_api import google_login, GoogleLoginRequest
        data = GoogleLoginRequest(email="t@t.com", full_name="Test User", google_id="g-1")
        result = await google_login(data, self.mock_request)

        self.assertIn("access_token", result)
        self.assertEqual(result["user"]["email"], "t@t.com")
        mock_db.execute.assert_called_once()

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.create_access_token")
    @patch("app.api.auth_api.hash_password")
    @patch("app.api.auth_api.log_activity")
    async def test_new_user_auto_register(
        self, mock_log, mock_hash, mock_create_token, mock_rate, mock_db, mock_cols
    ):
        mock_create_token.return_value = "jwt-token"
        mock_hash.return_value = "hashed_pw"
        mock_log.return_value = None

        call_count = [0]

        async def fake_fetch_one(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                return None
            return {
                "id": "new-user-uuid", "full_name": "New Google User",
                "email": "g@t.com", "role": "patient",
                "must_change_password": False, "status": "active",
                "profile_completed": False, "is_verified": False,
                "avatar_url": "https://pic", "google_id": "g-2",
            }

        mock_db.fetch_one = AsyncMock(side_effect=fake_fetch_one)
        mock_db.fetch_all = AsyncMock(return_value=[{"column_name": "user_id"}])
        mock_db.execute = AsyncMock()

        from app.api.auth_api import google_login, GoogleLoginRequest
        data = GoogleLoginRequest(email="g@t.com", full_name="New Google User", google_id="g-2")
        result = await google_login(data, self.mock_request)

        self.assertIn("access_token", result)
        self.assertEqual(result["user"]["email"], "g@t.com")

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.log_activity")
    async def test_inactive_user(
        self, mock_log, mock_rate, mock_db, mock_cols
    ):
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "role": "patient", "must_change_password": False, "status": "disabled",
            "profile_completed": True, "is_verified": True, "avatar_url": None,
            "google_id": "g-1",
        })

        from app.api.auth_api import google_login, GoogleLoginRequest
        data = GoogleLoginRequest(email="t@t.com", full_name="Test User", google_id="g-1")
        with self.assertRaises(HTTPException) as ctx:
            await google_login(data, self.mock_request)
        self.assertEqual(ctx.exception.status_code, 403)


class TestLogout(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    async def test_logout_success(self, mock_jwt_decode, mock_db):
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "jti-1", "exp": 9999999999}
        mock_db.execute = AsyncMock()

        from app.api.auth_api import logout
        result = await logout(authorization="Bearer token")
        self.assertEqual(result["message"], "Logged out successfully")
        mock_db.execute.assert_called_once()

    @patch("app.api.auth_api.database")
    async def test_logout_no_token(self, mock_db):
        from app.api.auth_api import logout
        result = await logout(authorization=None)
        self.assertEqual(result["message"], "Logged out successfully")
        mock_db.execute.assert_not_called()


class TestForgotPassword(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.create_otp_token")
    @patch("app.api.auth_api.send_forgot_password_otp_email")
    @patch("app.api.auth_api.log_activity")
    async def test_request_otp_known_email(
        self, mock_log, mock_send_email, mock_create_otp, mock_rate, mock_ip, mock_db
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_create_otp.return_value = "654321"
        mock_send_email.return_value = True
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "role": "patient"
        })

        from app.api.auth_api import request_forgot_password_otp, ForgotPasswordRequest
        data = ForgotPasswordRequest(email="t@t.com")
        result = await request_forgot_password_otp(data, self.mock_request)

        self.assertIn("message", result)
        self.assertEqual(result["email"], "t@t.com")

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    async def test_request_otp_unknown_email(
        self, mock_rate, mock_ip, mock_db
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_db.fetch_one = AsyncMock(return_value=None)

        from app.api.auth_api import request_forgot_password_otp, ForgotPasswordRequest
        data = ForgotPasswordRequest(email="unknown@t.com")
        result = await request_forgot_password_otp(data, self.mock_request)

        self.assertIn("message", result)

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.hash_password")
    @patch("app.api.auth_api.log_activity")
    async def test_verify_otp_with_new_password(
        self, mock_log, mock_hash, mock_rate, mock_ip, mock_db
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_hash.return_value = "new_hashed"
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "role": "patient"
        })
        mock_db.execute = AsyncMock()

        from app.api.auth_api import verify_forgot_password_otp, ForgotPasswordVerifyRequest
        mock_otp_result = MagicMock()
        mock_otp_result.is_valid = True
        mock_otp_result.metadata = {"user_id": "user-1"}

        with patch("app.api.auth_api.verify_otp_token", return_value=mock_otp_result):
            data = ForgotPasswordVerifyRequest(email="t@t.com", otp="654321", new_password="NewStr@ng1!")
            result = await verify_forgot_password_otp(data, self.mock_request)

        self.assertEqual(result["message"], "Password has been reset successfully.")

    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.get_client_ip")
    @patch("app.api.auth_api.check_rate_limit")
    @patch("app.api.auth_api.hash_password")
    @patch("app.api.auth_api.send_random_password_email")
    @patch("app.api.auth_api.log_activity")
    async def test_verify_otp_random_password(
        self, mock_log, mock_send_email, mock_hash, mock_rate, mock_ip, mock_db
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_hash.return_value = "new_hashed"
        mock_send_email.return_value = True
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "role": "patient"
        })
        mock_db.execute = AsyncMock()

        from app.api.auth_api import verify_forgot_password_otp, ForgotPasswordVerifyRequest
        mock_otp_result = MagicMock()
        mock_otp_result.is_valid = True
        mock_otp_result.metadata = {"user_id": "user-1"}

        with patch("app.api.auth_api.verify_otp_token", return_value=mock_otp_result):
            data = ForgotPasswordVerifyRequest(email="t@t.com", otp="654321")
            result = await verify_forgot_password_otp(data, self.mock_request)

        self.assertIn("Password has been reset", result["message"])
        self.assertTrue(result["email_sent"])


class TestChangePassword(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    @patch("app.api.auth_api.verify_password")
    @patch("app.api.auth_api.hash_password")
    @patch("app.api.auth_api.create_access_token")
    @patch("app.api.auth_api.log_activity")
    async def test_change_password_success(
        self, mock_log, mock_create_token, mock_hash, mock_verify,
        mock_jwt_decode, mock_db, mock_cols
    ):
        auth_api_module._user_cache.clear()
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "jti-1", "exp": 9999999999}
        mock_verify.return_value = True
        mock_hash.return_value = "new_hash"
        mock_create_token.return_value = "new-jwt"
        mock_log.return_value = None
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "password_hash": "old_hash", "role": "patient", "phone": "0123",
            "must_change_password": True, "status": "active", "created_at": None,
            "profile_completed": True, "is_verified": True, "avatar_url": None,
        })
        mock_db.fetch_val = AsyncMock(return_value=None)
        mock_db.execute = AsyncMock()

        from app.api.auth_api import change_password, ChangePasswordRequest
        data = ChangePasswordRequest(old_password="old1", new_password="NewStr@ng1!")
        result = await change_password(data, self.mock_request, authorization="Bearer token")

        self.assertEqual(result["message"], "Password changed successfully")
        self.assertIn("access_token", result)

    @patch("app.api.auth_api.get_users_columns", return_value=MOCK_USER_COLUMNS)
    @patch("app.api.auth_api.database")
    @patch("app.api.auth_api.jwt.decode")
    @patch("app.api.auth_api.verify_password")
    async def test_change_password_wrong_old(
        self, mock_verify, mock_jwt_decode, mock_db, mock_cols
    ):
        auth_api_module._user_cache.clear()
        mock_jwt_decode.return_value = {"sub": "user-1", "jti": "jti-1"}
        mock_verify.return_value = False
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "password_hash": "hash", "role": "patient", "phone": "0123",
            "must_change_password": False, "status": "active", "created_at": None,
            "profile_completed": True, "is_verified": True, "avatar_url": None,
        })
        mock_db.fetch_val = AsyncMock(return_value=None)

        from app.api.auth_api import change_password, ChangePasswordRequest
        data = ChangePasswordRequest(old_password="wrong", new_password="NewStr@ng1!")
        with self.assertRaises(HTTPException) as ctx:
            await change_password(data, self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 400)


class TestMe(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.auth_api.get_user_from_token")
    async def test_me_returns_user(self, mock_get_user):
        mock_get_user.return_value = {
            "id": "user-1", "full_name": "Test User", "email": "t@t.com",
            "role": "patient", "profile_completed": True,
        }

        from app.api.auth_api import me
        result = await me(authorization="Bearer token")
        self.assertIn("user", result)
        self.assertEqual(result["user"]["id"], "user-1")


if __name__ == "__main__":
    unittest.main()
