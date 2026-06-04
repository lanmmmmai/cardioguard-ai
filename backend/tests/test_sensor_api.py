import os, sys, unittest, types
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from fastapi import HTTPException

MOCK_DEVICE_COLUMNS = {"id", "patient_id", "name", "device_mac", "status", "battery",
    "last_seen_at", "device_type", "firmware_version", "device_token_hash",
    "token_last_rotated_at", "updated_at"}


class TestHelpers(unittest.TestCase):
    def test_normalize_device_identifier(self):
        from app.api.sensor_api import normalize_device_identifier
        self.assertEqual(normalize_device_identifier("AA:BB:CC:DD:EE:FF"), "aabbccddeeff")
        self.assertEqual(normalize_device_identifier("AA-BB-CC"), "aabbcc")

    def test_to_jsonable_datetime(self):
        from app.api.sensor_api import to_jsonable
        from datetime import datetime, timezone
        d = to_jsonable(datetime(2026, 1, 1, tzinfo=timezone.utc))
        self.assertIn("2026", d)

    def test_to_jsonable_decimal(self):
        from app.api.sensor_api import to_jsonable
        from decimal import Decimal
        self.assertIsInstance(to_jsonable(Decimal("3.14")), float)

    def test_to_jsonable_other(self):
        from app.api.sensor_api import to_jsonable
        self.assertEqual(to_jsonable("hello"), "hello")

    def test_row_to_dict(self):
        from app.api.sensor_api import row_to_dict
        d = row_to_dict({"a": 1, "b": "x"})
        self.assertEqual(d["a"], 1)

    def test_verify_iot_device_token_hash(self):
        from app.api.sensor_api import verify_iot_device_token
        with patch("app.api.sensor_api.verify_password", return_value=True):
            self.assertTrue(verify_iot_device_token({"device_token_hash": "hash"}, "token"))

    def test_verify_iot_device_token_shared(self):
        from app.api.sensor_api import verify_iot_device_token
        with patch("app.api.sensor_api.verify_password", return_value=False):
            with patch("app.api.sensor_api.settings") as mock_s:
                mock_s.IOT_DEVICE_SHARED_TOKEN = "shared"
                self.assertTrue(verify_iot_device_token({"device_token_hash": None}, "shared"))

    def test_verify_iot_device_token_fail(self):
        from app.api.sensor_api import verify_iot_device_token
        with patch("app.api.sensor_api.verify_password", return_value=False):
            with patch("app.api.sensor_api.settings") as mock_s:
                mock_s.IOT_DEVICE_SHARED_TOKEN = "shared"
                self.assertFalse(verify_iot_device_token({"device_token_hash": None}, "wrong"))


class TestEnsurePatientAccess(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.sensor_api.database")
    async def test_admin_access(self, mock_db):
        from app.api.sensor_api import ensure_patient_access
        await ensure_patient_access({"id": "a1", "role": "admin"}, "any-patient")
        mock_db.fetch_one.assert_not_called()

    async def test_patient_own(self):
        from app.api.sensor_api import ensure_patient_access
        await ensure_patient_access({"id": "p1", "role": "patient"}, "p1")

    async def test_patient_other_denied(self):
        from app.api.sensor_api import ensure_patient_access
        with self.assertRaises(HTTPException) as ctx:
            await ensure_patient_access({"id": "p1", "role": "patient"}, "p2")
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.api.sensor_api.database")
    async def test_doctor_assigned(self, mock_db):
        from app.api.sensor_api import ensure_patient_access
        mock_db.fetch_one = AsyncMock(return_value={"1": 1})
        await ensure_patient_access({"id": "d1", "role": "doctor"}, "p1")

    @patch("app.api.sensor_api.database")
    async def test_doctor_unassigned_denied(self, mock_db):
        from app.api.sensor_api import ensure_patient_access
        mock_db.fetch_one = AsyncMock(return_value=None)
        with self.assertRaises(HTTPException) as ctx:
            await ensure_patient_access({"id": "d1", "role": "doctor"}, "p1")
        self.assertEqual(ctx.exception.status_code, 403)


class TestDetectAbnormalIoT(unittest.TestCase):
    @patch("app.api.sensor_api.detect_abnormal")
    def test_with_bp(self, mock_detect):
        from app.api.sensor_api import detect_abnormal_iot
        from app.api.sensor_api import TelemetryForAI
        mock_detect.return_value = [{"alert_type": "HIGH_HEART_RATE", "message": "x", "severity": "high"}]
        readings = MagicMock(
            heart_rate=120, spo2=98, systolic_bp=140, diastolic_bp=90, ecg_value=0.5
        )
        alerts = detect_abnormal_iot(readings)
        self.assertEqual(len(alerts), 1)

    @patch("app.api.sensor_api.detect_abnormal")
    def test_without_bp_filters_bp_alerts(self, mock_detect):
        from app.api.sensor_api import detect_abnormal_iot
        mock_detect.return_value = [
            {"alert_type": "HIGH_BLOOD_PRESSURE", "message": "bp", "severity": "high"},
            {"alert_type": "LOW_SPO2", "message": "spo2", "severity": "low"},
        ]
        readings = MagicMock(
            heart_rate=72, spo2=95, systolic_bp=None, diastolic_bp=None, ecg_value=0.0
        )
        alerts = detect_abnormal_iot(readings)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["alert_type"], "LOW_SPO2")


class TestGetDeviceByMac(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.sensor_api.get_devices_table_columns", return_value=MOCK_DEVICE_COLUMNS)
    @patch("app.api.sensor_api.database")
    async def test_found(self, mock_db, mock_cols):
        from app.api.sensor_api import get_device_by_mac
        mock_db.fetch_one = AsyncMock(return_value={"id": "d1", "patient_id": "p1", "status": "online",
            "device_mac": "aa:bb:cc:dd:ee:ff", "device_token_hash": "hash",
            "token_last_rotated_at": None, "firmware_version": "1.0"})
        result = await get_device_by_mac("AA:BB:CC:DD:EE:FF")
        self.assertEqual(result["id"], "d1")

    @patch("app.api.sensor_api.get_devices_table_columns", return_value=MOCK_DEVICE_COLUMNS)
    @patch("app.api.sensor_api.database")
    async def test_not_found(self, mock_db, mock_cols):
        from app.api.sensor_api import get_device_by_mac
        mock_db.fetch_one = AsyncMock(return_value=None)
        result = await get_device_by_mac("AA:BB:CC:DD:EE:FF")
        self.assertIsNone(result)


class TestCreateSensorData(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.sensor_api.get_user_from_token")
    @patch("app.api.sensor_api.database")
    @patch("app.api.sensor_api.detect_abnormal")
    @patch("app.api.sensor_api.log_activity")
    @patch("app.api.sensor_api.manager")
    async def test_success_normal(
        self, mock_manager, mock_log, mock_detect, mock_db, mock_get_user
    ):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_log.return_value = None
        mock_detect.return_value = []
        mock_db.fetch_one = AsyncMock(return_value={"id": "sensor-uuid"})
        mock_db.execute = AsyncMock()
        mock_manager.broadcast_sensor_data = AsyncMock()

        from app.api.sensor_api import create_sensor_data, SensorDataCreate
        data = SensorDataCreate(patient_id="p1", heart_rate=72, spo2=98, systolic_bp=120, diastolic_bp=80, ecg_value=0.5)
        result = await create_sensor_data(data, self.mock_request, authorization="Bearer token")

        self.assertEqual(result["message"], "Sensor data saved successfully")
        self.assertFalse(result["is_abnormal"])

    @patch("app.api.sensor_api.get_user_from_token")
    @patch("app.api.sensor_api.database")
    @patch("app.api.sensor_api.detect_abnormal")
    @patch("app.api.sensor_api.log_activity")
    @patch("app.api.sensor_api.manager")
    async def test_success_abnormal(
        self, mock_manager, mock_log, mock_detect, mock_db, mock_get_user
    ):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_log.return_value = None
        mock_detect.return_value = [{"alert_type": "HIGH_HEART_RATE", "message": "x", "severity": "high"}]
        mock_db.fetch_one = AsyncMock(return_value={"id": "sensor-uuid"})
        mock_db.execute = AsyncMock()
        mock_manager.broadcast_sensor_data = AsyncMock()
        mock_manager.broadcast_alert = AsyncMock()

        from app.api.sensor_api import create_sensor_data, SensorDataCreate
        data = SensorDataCreate(patient_id="p1", heart_rate=140, spo2=98, systolic_bp=120, diastolic_bp=80, ecg_value=0.5)
        result = await create_sensor_data(data, self.mock_request, authorization="Bearer token")

        self.assertTrue(result["is_abnormal"])
        self.assertEqual(len(result["alerts"]), 1)


class TestCreateIotTelemetry(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.sensor_api.get_device_by_mac")
    @patch("app.api.sensor_api.has_any_iot_token_config")
    @patch("app.api.sensor_api.verify_iot_device_token")
    @patch("app.api.sensor_api.database")
    @patch("app.api.sensor_api.detect_abnormal_iot")
    @patch("app.api.sensor_api.manager")
    @patch("app.core.rate_limit.get_client_ip")
    @patch("app.core.rate_limit.check_rate_limit")
    @patch("app.api.sensor_api.log_activity")
    async def test_success(
        self, mock_log, mock_rate, mock_ip, mock_manager, mock_detect,
        mock_db, mock_verify, mock_has_token, mock_get_device
    ):
        mock_ip.return_value = "127.0.0.1"
        mock_get_device.return_value = {
            "id": "device-uuid", "patient_id": "patient-uuid", "status": "online",
            "device_mac": "aa:bb:cc:dd:ee:ff", "device_token_hash": "hash",
            "battery": 85,
        }
        mock_has_token.return_value = True
        mock_verify.return_value = True
        mock_detect.return_value = []
        mock_manager.broadcast_sensor_data = AsyncMock()
        mock_log.return_value = None
        mock_db.execute = AsyncMock()

        from app.api.sensor_api import create_iot_telemetry, IotTelemetryPayload
        from app.schemas.sensor_schema import IotTelemetryReadings, IotTelemetryDevice
        readings = IotTelemetryReadings(heart_rate=72, spo2=98, ecg_value=0.0)
        device_info = IotTelemetryDevice(battery=85)
        data = IotTelemetryPayload(readings=readings, device=device_info)
        result = await create_iot_telemetry(
            data, self.mock_request,
            x_device_uid="test-device",
            x_device_mac="AA:BB:CC:DD:EE:FF",
            x_device_token="valid-token",
        )
        self.assertEqual(result["message"], "Telemetry accepted")
        self.assertEqual(result["patient_id"], "patient-uuid")

    @patch("app.core.rate_limit.get_client_ip")
    @patch("app.core.rate_limit.check_rate_limit")
    async def test_invalid_mac(self, mock_rate, mock_ip):
        mock_ip.return_value = "127.0.0.1"
        from app.api.sensor_api import create_iot_telemetry, IotTelemetryPayload
        from app.schemas.sensor_schema import TelemetryReadings
        readings = TelemetryReadings(heart_rate=72, spo2=98, systolic_bp=None, diastolic_bp=None, ecg_value=0.0)
        data = IotTelemetryPayload(readings=readings)
        with self.assertRaises(HTTPException) as ctx:
            await create_iot_telemetry(
                data, self.mock_request,
                x_device_uid="test", x_device_mac="INVALID", x_device_token="tok"
            )
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("app.api.sensor_api.get_device_by_mac")
    @patch("app.core.rate_limit.get_client_ip")
    @patch("app.core.rate_limit.check_rate_limit")
    async def test_device_not_found(self, mock_rate, mock_ip, mock_get_device):
        mock_ip.return_value = "127.0.0.1"
        mock_get_device.return_value = None
        from app.api.sensor_api import create_iot_telemetry, IotTelemetryPayload
        from app.schemas.sensor_schema import TelemetryReadings
        readings = TelemetryReadings(heart_rate=72, spo2=98, systolic_bp=None, diastolic_bp=None, ecg_value=0.0)
        data = IotTelemetryPayload(readings=readings)
        with self.assertRaises(HTTPException) as ctx:
            await create_iot_telemetry(
                data, self.mock_request,
                x_device_uid="test", x_device_mac="AA:BB:CC:DD:EE:FF", x_device_token="tok"
            )
        self.assertEqual(ctx.exception.status_code, 404)

    @patch("app.api.sensor_api.get_device_by_mac")
    @patch("app.api.sensor_api.has_any_iot_token_config")
    @patch("app.core.rate_limit.get_client_ip")
    @patch("app.core.rate_limit.check_rate_limit")
    async def test_no_token_config(self, mock_rate, mock_ip, mock_has_token, mock_get_device):
        mock_ip.return_value = "127.0.0.1"
        mock_get_device.return_value = {"id": "d1", "patient_id": "p1", "status": "online"}
        mock_has_token.return_value = False
        from app.api.sensor_api import create_iot_telemetry, IotTelemetryPayload
        from app.schemas.sensor_schema import TelemetryReadings
        data = IotTelemetryPayload(readings=TelemetryReadings(heart_rate=72, spo2=98, systolic_bp=None, diastolic_bp=None, ecg_value=0.0))
        with self.assertRaises(HTTPException) as ctx:
            await create_iot_telemetry(
                data, self.mock_request,
                x_device_uid="test", x_device_mac="AA:BB:CC:DD:EE:FF", x_device_token="tok"
            )
        self.assertEqual(ctx.exception.status_code, 503)


class TestGetIoTDeviceStatus(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.sensor_api.get_user_from_token")
    @patch("app.api.sensor_api.ensure_device_access")
    async def test_success(self, mock_ensure, mock_get_user):
        mock_get_user.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_ensure.return_value = {
            "id": "d1", "patient_id": "p1", "device_mac": "aa:bb:cc:dd:ee:ff",
            "status": "online", "battery": 80, "last_seen_at": None,
            "device_type": "ecg", "firmware_version": "1.0", "updated_at": None,
        }
        from app.api.sensor_api import get_iot_device_status
        result = await get_iot_device_status("test-device", authorization="Bearer token")
        self.assertEqual(result["device_uid"], "test-device")
        self.assertEqual(result["status"], "online")


class TestRotateIoTDeviceToken(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_request = types.SimpleNamespace()
        self.mock_request.client = types.SimpleNamespace()
        self.mock_request.client.host = "127.0.0.1"

    @patch("app.api.sensor_api.get_user_from_token")
    @patch("app.api.sensor_api.ensure_device_access")
    @patch("app.api.sensor_api.get_devices_table_columns", return_value=MOCK_DEVICE_COLUMNS)
    @patch("app.api.sensor_api.hash_password")
    @patch("app.api.sensor_api.database")
    @patch("app.api.sensor_api.log_activity")
    async def test_admin_success(
        self, mock_log, mock_db, mock_hash, mock_cols, mock_ensure, mock_get_user
    ):
        mock_get_user.return_value = {"id": "admin-uuid", "role": "admin"}
        mock_hash.return_value = "hashed-token"
        mock_log.return_value = None
        mock_ensure.return_value = {"id": "d1", "patient_id": "p1"}
        mock_db.execute = AsyncMock()
        from app.api.sensor_api import rotate_iot_device_token
        result = await rotate_iot_device_token("test-device", self.mock_request, authorization="Bearer token")
        self.assertIn("device_token", result)

    @patch("app.api.sensor_api.get_user_from_token")
    async def test_patient_denied(self, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        from app.api.sensor_api import rotate_iot_device_token
        with self.assertRaises(HTTPException) as ctx:
            await rotate_iot_device_token("test-device", self.mock_request, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)


class TestGetSensorData(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.sensor_api.get_user_from_token")
    @patch("app.api.sensor_api.database")
    async def test_patient_gets_own(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "p1", "role": "patient"}
        mock_db.fetch_val = AsyncMock(return_value=5)
        mock_db.fetch_all = AsyncMock(return_value=[
            {"id": "s1", "patient_id": "p1", "heart_rate": 72, "spo2": 98,
             "systolic_bp": None, "diastolic_bp": None, "ecg_value": 0.0, "created_at": None}
        ])
        from app.api.sensor_api import get_sensor_data
        result = await get_sensor_data(authorization="Bearer token", patient_id=None)
        self.assertEqual(result["total"], 5)

    @patch("app.api.sensor_api.get_user_from_token")
    @patch("app.api.sensor_api.database")
    async def test_admin_gets_all(self, mock_db, mock_get_user):
        mock_get_user.return_value = {"id": "a1", "role": "admin"}
        mock_db.fetch_val = AsyncMock(return_value=10)
        mock_db.fetch_all = AsyncMock(return_value=[
            {"id": "s1", "patient_id": "p1", "heart_rate": 72, "spo2": 98,
             "systolic_bp": None, "diastolic_bp": None, "ecg_value": 0.0, "created_at": None}
        ])
        from app.api.sensor_api import get_sensor_data
        result = await get_sensor_data(authorization="Bearer token", patient_id=None)
        self.assertEqual(result["total"], 10)


class TestGetSensorHistory(unittest.IsolatedAsyncioTestCase):
    @patch("app.api.sensor_api.get_sensor_data")
    async def test_wraps_get_sensor_data(self, mock_get):
        mock_get.return_value = {"items": [], "total": 0, "limit": 25, "offset": 0}
        from app.api.sensor_api import get_sensor_history
        result = await get_sensor_history(authorization="Bearer token")
        self.assertEqual(result["total"], 0)


if __name__ == "__main__":
    unittest.main()
