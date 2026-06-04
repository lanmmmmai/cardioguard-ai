"""Unit tests for profile_schema.py — Patient/Doctor profile update schemas.

Run: python -m unittest tests.test_profile_schema
"""

import os, sys, unittest
from pathlib import Path
from datetime import date

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.schemas.profile_schema import (
    PatientProfileUpdate,
    DoctorProfileUpdate,
    DoctorVerificationAction,
)


class TestPatientProfileUpdate(unittest.TestCase):
    """Tests for PatientProfileUpdate schema."""

    def test_valid_minimal(self):
        schema = PatientProfileUpdate(full_name="Nguyen Van A")
        self.assertEqual(schema.full_name, "Nguyen Van A")
        self.assertIsNone(schema.phone)
        self.assertIsNone(schema.blood_type)

    def test_valid_full_profile(self):
        schema = PatientProfileUpdate(
            full_name="Nguyen Van A",
            phone="0909123456",
            gender="Nam",
            date_of_birth=date(1990, 1, 1),
            address="Ha Noi",
            blood_type="A+",
            medical_history="Khoe manh",
            allergies="Pollen",
            emergency_contact_name="Nguyen Van B",
            emergency_contact_phone="0909987654",
            avatar_url="https://example.com/avatar.jpg",
        )
        self.assertEqual(schema.blood_type, "A+")
        self.assertEqual(schema.emergency_contact_name, "Nguyen Van B")

    def test_optional_fields_can_be_none(self):
        schema = PatientProfileUpdate(full_name="Nguyen Van A", phone=None, gender=None)
        self.assertIsNone(schema.gender)


class TestDoctorProfileUpdate(unittest.TestCase):
    """Tests for DoctorProfileUpdate schema."""

    def test_valid_minimal(self):
        schema = DoctorProfileUpdate(
            full_name="Bac Si A",
            specialty="Tim mach",
            license_number="LIC123",
            license_certificate_url="https://example.com/license.pdf",
            cccd_front_url="https://example.com/cccd_front.jpg",
            cccd_back_url="https://example.com/cccd_back.jpg",
        )
        self.assertEqual(schema.specialty, "Tim mach")

    def test_valid_full_profile(self):
        schema = DoctorProfileUpdate(
            full_name="Bac Si A",
            gender="Nam",
            date_of_birth=date(1985, 5, 15),
            phone="0909123456",
            address="TP HCM",
            specialty="Noi khoa",
            position="Truong khoa",
            workplace="Benh vien A",
            experience_years=10,
            license_number="LIC123",
            license_issued_date=date(2010, 1, 1),
            license_issued_by="Bo Y te",
            license_certificate_url="https://example.com/license.pdf",
            cccd_front_url="https://example.com/cccd_front.jpg",
            cccd_back_url="https://example.com/cccd_back.jpg",
            avatar_url="https://example.com/avatar.jpg",
        )
        self.assertEqual(schema.experience_years, 10)
        self.assertEqual(schema.workplace, "Benh vien A")

    def test_missing_required_fields(self):
        with self.assertRaises(ValueError):
            DoctorProfileUpdate(
                full_name="Bac Si A",
            )


class TestDoctorVerificationAction(unittest.TestCase):
    """Tests for DoctorVerificationAction schema."""

    def test_valid_without_note(self):
        schema = DoctorVerificationAction()
        self.assertIsNone(schema.verification_note)

    def test_valid_with_note(self):
        schema = DoctorVerificationAction(verification_note="Da xac thuc ho so")
        self.assertEqual(schema.verification_note, "Da xac thuc ho so")


if __name__ == "__main__":
    unittest.main()
