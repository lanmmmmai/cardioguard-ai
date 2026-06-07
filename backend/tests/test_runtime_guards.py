"""Regression tests for runtime safety guards.

Run with:
    python -m unittest backend.tests.test_runtime_guards
"""

import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.ai.heart_ai import detect_abnormal  # noqa: E402
from app.core import rate_limit  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.core.password_policy import validate_password  # noqa: E402
from app.services import audit_service  # noqa: E402


class TestRuntimeGuards(unittest.IsolatedAsyncioTestCase):
    """Verify runtime guards that protect production and telemetry flows."""

    def test_detect_abnormal_ignores_missing_sensor_values(self):
        """Missing numeric sensor values must not crash the alert pipeline."""
        telemetry = SimpleNamespace(
            heart_rate=None,
            spo2=None,
            systolic_bp=155,
            diastolic_bp=None,
            ecg_value=None,
        )

        alerts = detect_abnormal(telemetry)

        self.assertEqual(
            alerts,
            [
                {
                    "alert_type": "HIGH_BLOOD_PRESSURE",
                    "message": "Huyết áp cao",
                    "severity": "medium",
                }
            ],
        )

    def test_settings_reject_exposed_dev_otp_in_production(self):
        """Production config must reject dev OTP exposure."""
        with self.assertRaises(ValueError):
            Settings(
                DATABASE_URL="postgresql+asyncpg://test:test@localhost:5432/test_db",
                SECRET_KEY="test-secret-key-with-at-least-32-chars",
                ENVIRONMENT="production",
                EXPOSE_DEV_OTP=True,
            )

    def test_validate_password_rejects_common_passwords(self):
        """Common passwords must be rejected even if they match the regex."""
        with self.assertRaises(ValueError):
            validate_password("Password123!")

    async def test_rate_limit_store_is_bounded(self):
        """In-memory rate-limit storage must not grow without bound."""
        rate_limit._rate_limits.clear()

        for index in range(rate_limit._RATE_LIMIT_STORE_MAX_KEYS + 50):
            await rate_limit.check_rate_limit(
                ip=f"10.0.0.{index}",
                email=f"user{index}@example.com",
                endpoint="/auth/login",
                max_requests=5,
                window_seconds=60,
            )

        self.assertLessEqual(len(rate_limit._rate_limits), rate_limit._RATE_LIMIT_STORE_MAX_KEYS)


class TestAuditShutdown(unittest.IsolatedAsyncioTestCase):
    """Verify audit buffer cleanup on shutdown."""

    async def asyncSetUp(self):
        audit_service._audit_buffer.clear()
        audit_service._flush_task = None

    async def test_shutdown_flushes_buffer(self):
        """Shutdown must flush pending audit entries before DB disconnect."""
        await audit_service.log_activity(
            user_id="user-1",
            action="LOGIN",
            entity_type="users",
            entity_id="user-1",
        )

        with patch.object(audit_service, "_flush_buffer", AsyncMock()) as flush_mock:
            await audit_service.shutdown_audit_logging()

        flush_mock.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
