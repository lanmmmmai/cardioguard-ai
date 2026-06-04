"""Unit tests for sensor_schema.py — SensorDataCreate and IoT telemetry validation.

Run: python -m unittest tests.test_sensor_schema
"""

import os, sys, unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.schemas.sensor_schema import (
    SensorDataCreate,
    IotTelemetryReadings,
    IotTelemetryDevice,
    IotTelemetrySignal,
    IotTelemetryPayload,
)


class TestSensorDataCreate(unittest.TestCase):
    """Tests for SensorDataCreate — manual sensor data submission."""

    def test_valid_sensor_data(self):
        schema = SensorDataCreate(
            patient_id="uuid-1",
            heart_rate=72,
            spo2=98,
            systolic_bp=120,
            diastolic_bp=80,
            ecg_value=0.15,
        )
        self.assertEqual(schema.heart_rate, 72)
        self.assertEqual(schema.spo2, 98)

    def test_heart_rate_below_range_rejected(self):
        with self.assertRaises(ValueError):
            SensorDataCreate(
                patient_id="uuid-1", heart_rate=-1, spo2=98,
                systolic_bp=120, diastolic_bp=80, ecg_value=0.1,
            )

    def test_heart_rate_above_range_rejected(self):
        with self.assertRaises(ValueError):
            SensorDataCreate(
                patient_id="uuid-1", heart_rate=999, spo2=98,
                systolic_bp=120, diastolic_bp=80, ecg_value=0.1,
            )

    def test_spo2_above_range_rejected(self):
        with self.assertRaises(ValueError):
            SensorDataCreate(
                patient_id="uuid-1", heart_rate=72, spo2=150,
                systolic_bp=120, diastolic_bp=80, ecg_value=0.1,
            )

    def test_bp_systolic_less_than_diastolic_rejected(self):
        with self.assertRaises(ValueError):
            SensorDataCreate(
                patient_id="uuid-1", heart_rate=72, spo2=98,
                systolic_bp=80, diastolic_bp=120, ecg_value=0.1,
            )

    def test_bp_boundary_equal_values(self):
        schema = SensorDataCreate(
            patient_id="uuid-1", heart_rate=72, spo2=98,
            systolic_bp=120, diastolic_bp=120, ecg_value=0.1,
        )
        self.assertEqual(schema.systolic_bp, schema.diastolic_bp)

    def test_systolic_above_range_rejected(self):
        with self.assertRaises(ValueError):
            SensorDataCreate(
                patient_id="uuid-1", heart_rate=72, spo2=98,
                systolic_bp=999, diastolic_bp=80, ecg_value=0.1,
            )


class TestIotTelemetryReadings(unittest.TestCase):
    """Tests for IotTelemetryReadings — IoT device vital signs."""

    def test_valid_readings_minimal(self):
        schema = IotTelemetryReadings(
            heart_rate=72, spo2=98, ecg_value=0.15,
        )
        self.assertIsNone(schema.systolic_bp)
        self.assertIsNone(schema.body_temperature)

    def test_valid_readings_with_optional_fields(self):
        schema = IotTelemetryReadings(
            heart_rate=72, spo2=98, ecg_value=0.15,
            systolic_bp=120, diastolic_bp=80,
            body_temperature=37.0, motion_value=0.5,
        )
        self.assertEqual(schema.body_temperature, 37.0)

    def test_bp_invalid_rejected(self):
        with self.assertRaises(ValueError):
            IotTelemetryReadings(
                heart_rate=72, spo2=98, ecg_value=0.15,
                systolic_bp=80, diastolic_bp=120,
            )

    def test_body_temperature_below_range_rejected(self):
        with self.assertRaises(ValueError):
            IotTelemetryReadings(
                heart_rate=72, spo2=98, ecg_value=0.15,
                body_temperature=20.0,
            )

    def test_body_temperature_above_range_rejected(self):
        with self.assertRaises(ValueError):
            IotTelemetryReadings(
                heart_rate=72, spo2=98, ecg_value=0.15,
                body_temperature=50.0,
            )

    def test_motion_value_negative_rejected(self):
        with self.assertRaises(ValueError):
            IotTelemetryReadings(
                heart_rate=72, spo2=98, ecg_value=0.15,
                motion_value=-1.0,
            )


class TestIotTelemetryDevice(unittest.TestCase):
    """Tests for IotTelemetryDevice — device metadata."""

    def test_all_fields_none_by_default(self):
        schema = IotTelemetryDevice()
        self.assertIsNone(schema.battery)
        self.assertIsNone(schema.rssi)
        self.assertIsNone(schema.firmware_version)

    def test_valid_device_data(self):
        schema = IotTelemetryDevice(battery=85, rssi=-60, firmware_version="v2.1", uptime_ms=3600000)
        self.assertEqual(schema.battery, 85)


class TestIotTelemetrySignal(unittest.TestCase):
    """Tests for IotTelemetrySignal — signal quality flags."""

    def test_all_fields_none_by_default(self):
        schema = IotTelemetrySignal()
        self.assertIsNone(schema.ppg_quality)
        self.assertIsNone(schema.leads_off)

    def test_valid_signal_data(self):
        schema = IotTelemetrySignal(
            ppg_quality="good", ecg_quality="fair",
            leads_off=False, motion_detected=True,
        )
        self.assertTrue(schema.motion_detected)


class TestIotTelemetryPayload(unittest.TestCase):
    """Tests for IotTelemetryPayload — top-level IoT envelope."""

    def test_valid_payload_minimal(self):
        schema = IotTelemetryPayload(
            readings=IotTelemetryReadings(heart_rate=72, spo2=98, ecg_value=0.1),
        )
        self.assertIsNone(schema.mode)
        self.assertIsNone(schema.device)

    def test_valid_payload_full(self):
        schema = IotTelemetryPayload(
            sequence=1,
            mode="continuous",
            readings=IotTelemetryReadings(heart_rate=72, spo2=98, ecg_value=0.1),
            signal=IotTelemetrySignal(ppg_quality="good"),
            device=IotTelemetryDevice(battery=90),
        )
        self.assertEqual(schema.sequence, 1)
        self.assertEqual(schema.mode, "continuous")

    def test_missing_readings_rejected(self):
        with self.assertRaises(ValueError):
            IotTelemetryPayload()


if __name__ == "__main__":
    unittest.main()
