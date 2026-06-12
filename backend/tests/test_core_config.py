"""Unit tests for core/config.py — Settings validation, BASE_DIR resolution.

Run: python -m unittest tests.test_core_config
"""

import os, sys, unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")


class TestResolveBaseDir(unittest.TestCase):
    """Tests for resolve_base_dir function."""

    def setUp(self):
        self.orig_base_dir = os.environ.pop("CARDIOGUARD_BASE_DIR", None)

    def tearDown(self):
        if self.orig_base_dir is not None:
            os.environ["CARDIOGUARD_BASE_DIR"] = self.orig_base_dir
        else:
            os.environ.pop("CARDIOGUARD_BASE_DIR", None)

    def test_resolve_from_env(self):
        from app.core.config import resolve_base_dir
        test_path = str(BACKEND_DIR)
        os.environ["CARDIOGUARD_BASE_DIR"] = test_path
        result = resolve_base_dir()
        self.assertEqual(result, Path(test_path).resolve())

    def test_resolve_fallback(self):
        from app.core.config import resolve_base_dir
        result = resolve_base_dir()
        self.assertIsInstance(result, Path)
        self.assertTrue(str(result).replace("\\", "/").endswith("cardioguard-ai"))


class TestSettingsValidation(unittest.TestCase):
    """Tests for Settings Pydantic model."""

    def setUp(self):
        self.env_backup = dict(os.environ)

    def tearDown(self):
        os.environ.clear()
        os.environ.update(self.env_backup)

    def _make_settings(self, **overrides):
        from app.core.config import Settings
        defaults = {
            "DATABASE_URL": "postgresql+asyncpg://test:test@localhost:5432/test_db",
            "SECRET_KEY": "test-secret-key-with-at-least-32-chars",
            "ACCESS_TOKEN_EXPIRE_MINUTES": 60,
            "EXPOSE_DEV_OTP": False,
            "EMAIL_FROM_EMAIL": "noreply@giatky.site",
        }
        defaults.update(overrides)
        return Settings(_env_file=None, **defaults)

    def test_default_environment(self):
        s = self._make_settings()
        self.assertEqual(s.ENVIRONMENT, "development")

    def test_default_token_expiry(self):
        s = self._make_settings()
        self.assertEqual(s.ACCESS_TOKEN_EXPIRE_MINUTES, 60)

    def test_expose_dev_otp_default_false(self):
        s = self._make_settings()
        self.assertFalse(s.EXPOSE_DEV_OTP)

    def test_short_secret_key_rejected(self):
        with self.assertRaises(ValueError):
            self._make_settings(SECRET_KEY="short")

    def test_default_secret_key_value_rejected(self):
        with self.assertRaises(ValueError):
            self._make_settings(SECRET_KEY="secret_key")

    def test_heart_monitor_in_key_rejected(self):
        with self.assertRaises(ValueError):
            self._make_settings(SECRET_KEY="heart_monitor_default_key_12345678")

    def test_production_dev_otp_rejected(self):
        with self.assertRaises(ValueError):
            self._make_settings(ENVIRONMENT="production", EXPOSE_DEV_OTP=True)

    def test_production_without_dev_otp_ok(self):
        s = self._make_settings(ENVIRONMENT="production", EXPOSE_DEV_OTP=False)
        self.assertEqual(s.ENVIRONMENT, "production")

    def test_iot_token_empty_by_default(self):
        s = self._make_settings()
        self.assertEqual(s.IOT_DEVICE_SHARED_TOKEN, "")

    def test_smtp_defaults(self):
        s = self._make_settings()
        self.assertEqual(s.SMTP_PORT, 587)
        self.assertEqual(s.EMAIL_FROM_EMAIL, "noreply@giatky.site")


if __name__ == "__main__":
    unittest.main()
