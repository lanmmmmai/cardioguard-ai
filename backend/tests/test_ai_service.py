"""Unit tests for services/ai_service.py — mock responses and fallback logic.

Run: python -m unittest tests.test_ai_service
"""

import importlib
import os
import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")


def import_ai_service_without_openai_key():
    """Load ai_service in an isolated config context with no .env OpenAI key."""
    module_names = ("app.services.ai_service", "app.core.config")
    original_modules = {name: sys.modules.get(name) for name in module_names}
    services_package = sys.modules.get("app.services")
    core_package = sys.modules.get("app.core")
    original_ai_attr = getattr(services_package, "ai_service", None) if services_package else None
    original_config_attr = getattr(core_package, "config", None) if core_package else None

    for name in module_names:
        sys.modules.pop(name, None)
    if services_package and hasattr(services_package, "ai_service"):
        delattr(services_package, "ai_service")
    if core_package and hasattr(core_package, "config"):
        delattr(core_package, "config")

    try:
        with tempfile.TemporaryDirectory() as base_dir:
            test_env = {
                "CARDIOGUARD_BASE_DIR": base_dir,
                "DATABASE_URL": "postgresql+asyncpg://test:test@localhost:5432/test_db",
                "SECRET_KEY": "test-secret-key-with-at-least-32-chars",
                "OPENAI_API_KEY": "",
            }
            with patch.dict(os.environ, test_env, clear=False):
                return importlib.import_module("app.services.ai_service")
    finally:
        for name in module_names:
            sys.modules.pop(name, None)
        for name, module in original_modules.items():
            if module is not None:
                sys.modules[name] = module
        if services_package is not None:
            if original_ai_attr is not None:
                setattr(services_package, "ai_service", original_ai_attr)
            elif hasattr(services_package, "ai_service"):
                delattr(services_package, "ai_service")
        if core_package is not None:
            if original_config_attr is not None:
                setattr(core_package, "config", original_config_attr)
            elif hasattr(core_package, "config"):
                delattr(core_package, "config")


class TestMockResponse(unittest.TestCase):
    """Tests for _mock_response — rule-based fallback when no OpenAI key."""

    def setUp(self):
        from app.services.ai_service import AIService
        self.service = AIService

    def test_patient_heart_rate_query(self):
        result = self.service._mock_response("patient", "nhịp tim của tôi?", None)
        self.assertIn("nhịp tim", result.lower())
        self.assertIn("Mock Mode", result)

    def test_patient_spo2_query(self):
        result = self.service._mock_response("patient", "SpO2 của tôi?", None)
        self.assertIn("spo2", result.lower())
        self.assertIn("Mock Mode", result)

    def test_patient_blood_pressure_query(self):
        result = self.service._mock_response("patient", "huyết áp?", None)
        self.assertIn("huyết áp", result.lower())
        self.assertIn("Mock Mode", result)

    def test_patient_generic_query(self):
        result = self.service._mock_response("patient", "tôi bị đau đầu", None)
        self.assertIn("trợ lý AI", result)
        self.assertIn("Mock Mode", result)

    def test_doctor_generic_no_context(self):
        result = self.service._mock_response("doctor", "phân tích", None)
        self.assertIn("chế độ mô phỏng", result.lower())

    def test_doctor_with_sensor_context(self):
        context = {
            "recent_sensor_data": [
                {"heart_rate": 72, "spo2": 98, "systolic_bp": 120, "diastolic_bp": 80}
            ]
        }
        result = self.service._mock_response("doctor", "phân tích", context)
        self.assertIn("72", result)
        self.assertIn("98", result)

    def test_mock_detects_abnormal_heart_rate(self):
        context = {
            "recent_sensor_data": [
                {"heart_rate": 145, "spo2": 98, "systolic_bp": 120, "diastolic_bp": 80}
            ]
        }
        result = self.service._mock_response("patient", "sức khỏe", context)
        self.assertIn("CẦN CHÚ Ý", result)
        self.assertIn("145", result)

    def test_mock_detects_low_spo2(self):
        context = {
            "recent_sensor_data": [
                {"heart_rate": 72, "spo2": 88, "systolic_bp": 120, "diastolic_bp": 80}
            ]
        }
        result = self.service._mock_response("patient", "spo2", context)
        self.assertIn("CẦN CHÚ Ý", result)
        self.assertIn("88", result)

    def test_doctor_summary_with_context(self):
        context = {
            "recent_sensor_data": [
                {"heart_rate": 72, "spo2": 98, "systolic_bp": 120, "diastolic_bp": 80}
            ]
        }
        result = self.service._mock_response("doctor", "tóm tắt", context)
        self.assertIn("Tóm tắt", result)


class TestGenerateChatResponseInit(unittest.TestCase):
    """Tests for HAS_OPENAI initialization."""

    def test_has_openai_false_without_key(self):
        module = import_ai_service_without_openai_key()
        self.assertFalse(module.HAS_OPENAI)

    def test_client_none_without_key(self):
        module = import_ai_service_without_openai_key()
        self.assertIsNone(module.client)


class TestGenerateChatResponse(unittest.TestCase):
    """Tests for generate_chat_response — fallback when no OpenAI."""

    def setUp(self):
        from app.services import ai_service as ai_module
        self._patches = [
            patch.object(ai_module, "HAS_OPENAI", False),
            patch.object(ai_module, "client", None),
        ]
        for patcher in self._patches:
            patcher.start()
        self.service = ai_module.AIService

    def tearDown(self):
        for patcher in reversed(self._patches):
            patcher.stop()

    def test_fallback_without_openai(self):
        result = asyncio_run(self.service.generate_chat_response("patient", "nhịp tim"))
        self.assertIn("nhịp tim", result.lower())
        self.assertIn("Mock Mode", result)

    def test_fallback_doctor_role(self):
        result = asyncio_run(self.service.generate_chat_response("doctor", "phân tích"))
        self.assertIn("chế độ mô phỏng", result.lower())

    def test_fallback_with_context(self):
        context = {
            "recent_sensor_data": [
                {"heart_rate": 72, "spo2": 98, "systolic_bp": 120, "diastolic_bp": 80}
            ]
        }
        result = asyncio_run(self.service.generate_chat_response("patient", "sức khỏe", context))
        self.assertIn("72", result)
        self.assertIn("98", result)

    @patch("app.services.ai_service.HAS_OPENAI", False)
    def test_analyze_patient_data(self):
        from app.services.ai_service import AIService
        result = asyncio_run(AIService.analyze_patient_data(
            patient_id="uuid-1",
            sensor_data=[{"heart_rate": 72}],
            alerts=[{"type": "SOS"}],
        ))
        self.assertIsInstance(result, str)
        self.assertTrue(len(result) > 0)


def asyncio_run(coro):
    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


if __name__ == "__main__":
    unittest.main()
