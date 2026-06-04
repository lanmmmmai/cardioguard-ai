"""Unit tests for patient_schema.py — PatientCreate schema.

Run: python -m unittest tests.test_patient_schema
"""

import os, sys, unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.schemas.patient_schema import PatientCreate


class TestPatientCreate(unittest.TestCase):
    """Tests for PatientCreate schema."""

    def test_valid_patient(self):
        schema = PatientCreate(
            full_name="Nguyen Van A",
            age=30,
            gender="Nam",
            phone="0909123456",
            address="Ha Noi",
            medical_history="Khong co tien su",
        )
        self.assertEqual(schema.full_name, "Nguyen Van A")
        self.assertEqual(schema.age, 30)

    def test_age_zero(self):
        schema = PatientCreate(
            full_name="Baby", age=0, gender="Nam",
            phone="0123456789", address="HN", medical_history="",
        )
        self.assertEqual(schema.age, 0)

    def test_missing_required_field(self):
        with self.assertRaises(ValueError):
            PatientCreate(
                full_name="Nguyen Van A", age=30,
            )


if __name__ == "__main__":
    unittest.main()
