"""Unit tests for crud_schema.py — generic and domain-specific CRUD schemas.

Run: python -m unittest tests.test_crud_schema
"""

import os, sys, unittest
from pathlib import Path
from uuid import UUID

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.schemas.crud_schema import (
    CrudCreate,
    CrudUpdate,
    CrudRead,
    AppointmentCreate,
    AppointmentUpdate,
    MedicalRecordCreate,
    PrescriptionCreate,
    DeviceCreate,
    NotificationCreate,
    ChatMessageCreate,
    AuditLogCreate,
    CameraCreate,
    ReportCreate,
)


class TestCrudBase(unittest.TestCase):
    """Tests for base CRUD schema classes."""

    def test_crud_create_allows_extra_fields(self):
        schema = CrudCreate(title="hello", count=123)
        self.assertEqual(schema.title, "hello")
        self.assertEqual(schema.count, 123)

    def test_crud_update_allows_extra_fields(self):
        schema = CrudUpdate(status="active")
        self.assertEqual(schema.status, "active")

    def test_crud_read_requires_id(self):
        with self.assertRaises(ValueError):
            CrudRead()

    def test_crud_read_accepts_uuid_string(self):
        schema = CrudRead(id="550e8400-e29b-41d4-a716-446655440000")
        self.assertIsInstance(schema.id, UUID)


class TestAppointmentSchema(unittest.TestCase):
    """Tests for AppointmentCreate / AppointmentUpdate."""

    def test_create_minimal(self):
        schema = AppointmentCreate()
        self.assertIsNone(schema.patient_id)

    def test_create_with_fields(self):
        schema = AppointmentCreate(
            patient_id="550e8400-e29b-41d4-a716-446655440000",
            title="Kham dinh ky",
            status="scheduled",
        )
        self.assertEqual(schema.title, "Kham dinh ky")

    def test_update_inherits_create_fields(self):
        schema = AppointmentUpdate(status="completed")
        self.assertEqual(schema.status, "completed")


class TestMedicalRecordSchema(unittest.TestCase):
    """Tests for MedicalRecordCreate."""

    def test_create_minimal(self):
        schema = MedicalRecordCreate()
        self.assertIsNone(schema.diagnosis)

    def test_create_with_fields(self):
        schema = MedicalRecordCreate(
            patient_id="550e8400-e29b-41d4-a716-446655440000",
            type="checkup",
            diagnosis="Khoe manh",
        )
        self.assertEqual(schema.diagnosis, "Khoe manh")

    def test_files_field_optional(self):
        schema = MedicalRecordCreate(files=[{"name": "xray.pdf"}])
        self.assertEqual(len(schema.files), 1)


class TestPrescriptionSchema(unittest.TestCase):
    """Tests for PrescriptionCreate."""

    def test_create_minimal(self):
        schema = PrescriptionCreate()
        self.assertIsNone(schema.medication_name)

    def test_create_with_fields(self):
        schema = PrescriptionCreate(
            medication_name="Paracetamol",
            dosage="500mg",
            frequency="3x/ngay",
        )
        self.assertEqual(schema.medication_name, "Paracetamol")


class TestDeviceSchema(unittest.TestCase):
    """Tests for DeviceCreate."""

    def test_create_minimal(self):
        schema = DeviceCreate()
        self.assertIsNone(schema.device_type)

    def test_battery_range_valid(self):
        schema = DeviceCreate(battery=50)
        self.assertEqual(schema.battery, 50)

    def test_battery_out_of_range_rejected(self):
        with self.assertRaises(ValueError):
            DeviceCreate(battery=150)

    def test_battery_negative_rejected(self):
        with self.assertRaises(ValueError):
            DeviceCreate(battery=-1)


class TestNotificationSchema(unittest.TestCase):
    """Tests for NotificationCreate."""

    def test_create_minimal(self):
        schema = NotificationCreate()
        self.assertIsNone(schema.title)

    def test_create_with_fields(self):
        schema = NotificationCreate(
            user_id="550e8400-e29b-41d4-a716-446655440000",
            title="Thong bao",
            message="Noi dung",
            type="info",
        )
        self.assertEqual(schema.title, "Thong bao")


class TestChatMessageSchema(unittest.TestCase):
    """Tests for ChatMessageCreate."""

    def test_create_minimal(self):
        schema = ChatMessageCreate()
        self.assertIsNone(schema.message)

    def test_create_with_fields(self):
        schema = ChatMessageCreate(
            sender_id="550e8400-e29b-41d4-a716-446655440000",
            recipient_id="550e8400-e29b-41d4-a716-446655440001",
            message="Xin chao",
        )
        self.assertEqual(schema.message, "Xin chao")


class TestAuditLogSchema(unittest.TestCase):
    """Tests for AuditLogCreate."""

    def test_create_minimal(self):
        schema = AuditLogCreate()
        self.assertIsNone(schema.action)

    def test_create_with_details_dict(self):
        schema = AuditLogCreate(
            action="LOGIN",
            entity_type="users",
            details={"ip": "192.168.1.1"},
        )
        self.assertEqual(schema.details["ip"], "192.168.1.1")


class TestCameraSchema(unittest.TestCase):
    """Tests for CameraCreate."""

    def test_create_minimal(self):
        schema = CameraCreate()
        self.assertIsNone(schema.stream_url)

    def test_create_with_fields(self):
        schema = CameraCreate(
            name="Camera 1",
            location="Phong benh 101",
            status="active",
        )
        self.assertEqual(schema.location, "Phong benh 101")


class TestReportSchema(unittest.TestCase):
    """Tests for ReportCreate."""

    def test_create_minimal(self):
        schema = ReportCreate()
        self.assertIsNone(schema.title)

    def test_create_with_data_dict(self):
        schema = ReportCreate(
            title="Bao cao thang",
            report_type="monthly",
            data={"total_patients": 50},
        )
        self.assertEqual(schema.data["total_patients"], 50)


if __name__ == "__main__":
    unittest.main()
