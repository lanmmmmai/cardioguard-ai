"""Unit tests for user_schema.py — UserMeUpdate, PasswordUpdate, PatientMeUpdate, admin schemas.

Run: python -m unittest tests.test_user_schema
"""

import os, sys, unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.schemas.user_schema import (
    UserMeUpdate,
    PasswordUpdate,
    PatientMeUpdate,
    UserAdminCreate,
    UserAdminUpdate,
    validate_optional_phone,
)


class TestValidateOptionalPhone(unittest.TestCase):
    """Tests for validate_optional_phone helper."""

    def test_none_returns_none(self):
        self.assertIsNone(validate_optional_phone(None))

    def test_empty_returns_none(self):
        self.assertIsNone(validate_optional_phone("  "))

    def test_valid_phone(self):
        result = validate_optional_phone(" 0909123456 ")
        self.assertEqual(result, "0909123456")

    def test_invalid_phone_rejected(self):
        with self.assertRaises(ValueError):
            validate_optional_phone("abc")


class TestUserMeUpdate(unittest.TestCase):
    """Tests for UserMeUpdate schema."""

    def test_empty_update(self):
        schema = UserMeUpdate()
        self.assertIsNone(schema.full_name)

    def test_valid_update(self):
        schema = UserMeUpdate(full_name="Nguyen Van A", phone="0909123456")
        self.assertEqual(schema.full_name, "Nguyen Van A")
        self.assertEqual(schema.phone, "0909123456")

    def test_invalid_name_rejected(self):
        with self.assertRaises(ValueError):
            UserMeUpdate(full_name="John")

    def test_invalid_phone_rejected(self):
        with self.assertRaises(ValueError):
            UserMeUpdate(phone="not-a-phone")


class TestPasswordUpdate(unittest.TestCase):
    """Tests for PasswordUpdate schema."""

    def test_valid_change(self):
        schema = PasswordUpdate(
            current_password="OldPass1!",
            new_password="NewPass1!",
            confirm_password="NewPass1!",
        )
        self.assertEqual(schema.current_password, "OldPass1!")

    def test_weak_new_password_rejected(self):
        with self.assertRaises(ValueError):
            PasswordUpdate(
                current_password="OldPass1!",
                new_password="weak",
                confirm_password="weak",
            )

    def test_mismatched_confirmation_rejected(self):
        with self.assertRaises(ValueError):
            PasswordUpdate(
                current_password="OldPass1!",
                new_password="NewPass1!",
                confirm_password="DifferentPass1!",
            )


class TestPatientMeUpdate(unittest.TestCase):
    """Tests for PatientMeUpdate schema."""

    def test_empty_update(self):
        schema = PatientMeUpdate()
        self.assertIsNone(schema.full_name)

    def test_valid_update(self):
        schema = PatientMeUpdate(
            full_name="Nguyen Van A",
            age=30,
            gender="Nam",
            phone="0909123456",
            address="Ha Noi",
        )
        self.assertEqual(schema.age, 30)

    def test_age_out_of_range_rejected(self):
        with self.assertRaises(ValueError):
            PatientMeUpdate(age=200)

    def test_age_negative_rejected(self):
        with self.assertRaises(ValueError):
            PatientMeUpdate(age=-1)

    def test_invalid_gender_rejected(self):
        with self.assertRaises(ValueError):
            PatientMeUpdate(gender="Alien")

    def test_valid_gender_accepted(self):
        schema = PatientMeUpdate(gender="Nữ")
        self.assertEqual(schema.gender, "Nữ")
        schema2 = PatientMeUpdate(gender="Female")
        self.assertEqual(schema2.gender, "Female")

    def test_empty_text_field_becomes_none(self):
        schema = PatientMeUpdate(address="  ")
        self.assertIsNone(schema.address)

    def test_invalid_name_rejected(self):
        with self.assertRaises(ValueError):
            PatientMeUpdate(full_name="Single")


class TestUserAdminCreate(unittest.TestCase):
    """Tests for UserAdminCreate schema."""

    def test_valid_create(self):
        schema = UserAdminCreate(
            full_name="Nguyen Van A",
            email="a@example.com",
            role="doctor",
            password="StrongPass1!",
        )
        self.assertEqual(schema.role, "doctor")
        self.assertEqual(schema.status, "active")

    def test_invalid_role_rejected(self):
        with self.assertRaises(ValueError):
            UserAdminCreate(
                full_name="Nguyen Van A",
                email="a@example.com",
                role="superadmin",
                password="StrongPass1!",
            )

    def test_invalid_status_rejected(self):
        with self.assertRaises(ValueError):
            UserAdminCreate(
                full_name="Nguyen Van A",
                email="a@example.com",
                role="doctor",
                password="StrongPass1!",
                status="deleted",
            )

    def test_weak_password_rejected(self):
        with self.assertRaises(ValueError):
            UserAdminCreate(
                full_name="Nguyen Van A",
                email="a@example.com",
                role="doctor",
                password="weak",
            )


class TestUserAdminUpdate(unittest.TestCase):
    """Tests for UserAdminUpdate schema."""

    def test_empty_update(self):
        schema = UserAdminUpdate()
        self.assertIsNone(schema.full_name)

    def test_valid_partial_update(self):
        schema = UserAdminUpdate(full_name="Nguyen Van B", role="admin")
        self.assertEqual(schema.role, "admin")

    def test_invalid_role_rejected(self):
        with self.assertRaises(ValueError):
            UserAdminUpdate(role="superadmin")

    def test_invalid_status_rejected(self):
        with self.assertRaises(ValueError):
            UserAdminUpdate(status="deleted")

    def test_valid_password_update(self):
        schema = UserAdminUpdate(password="NewStrong1!")
        self.assertIsNotNone(schema.password)


if __name__ == "__main__":
    unittest.main()
