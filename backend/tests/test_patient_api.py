"""Unit tests for patient_api.py — create_patient (blocked) and get_patients.

Run: python -m unittest tests.test_patient_api
"""

import os, sys, unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")


class TestCreatePatient(unittest.IsolatedAsyncioTestCase):
    """Tests for create_patient — always blocked."""

    async def test_create_patient_raises_403(self):
        from app.api.patient_api import create_patient
        from app.schemas.patient_schema import PatientCreate
        from fastapi import HTTPException

        payload = PatientCreate(
            full_name="Test", age=30, gender="Nam",
            phone="0123456789", address="HN", medical_history="",
        )
        with self.assertRaises(HTTPException) as ctx:
            await create_patient(payload)
        self.assertEqual(ctx.exception.status_code, 403)


class TestGetPatients(unittest.IsolatedAsyncioTestCase):
    """Tests for get_patients with role-based scoping."""

    @patch("app.api.patient_api.get_user_from_token")
    @patch("app.api.patient_api.database")
    async def test_patient_sees_self(self, mock_db, mock_get_user):
        from app.api.patient_api import get_patients
        mock_get_user.return_value = {"id": "patient-uuid-1", "role": "patient"}
        mock_db.fetch_val = AsyncMock(return_value=1)
        mock_db.fetch_all = AsyncMock(return_value=[{
            "id": "patient-uuid-1",
            "user_full_name": "Me",
            "user_email": "me@example.com",
            "patient_full_name": None,
            "age": None,
            "gender": None,
            "phone": None,
            "address": None,
            "medical_history": None,
            "created_at": None,
        }])

        result = await get_patients(authorization="Bearer token")
        self.assertEqual(result["total"], 1)

    @patch("app.api.patient_api.get_user_from_token")
    @patch("app.api.patient_api.database")
    async def test_doctor_sees_assigned(self, mock_db, mock_get_user):
        from app.api.patient_api import get_patients
        mock_get_user.return_value = {"id": "doctor-uuid-1", "role": "doctor"}
        mock_db.fetch_val = AsyncMock(return_value=2)
        mock_db.fetch_all = AsyncMock(return_value=[])

        result = await get_patients(authorization="Bearer token")
        self.assertEqual(result["total"], 2)

    @patch("app.api.patient_api.get_user_from_token")
    @patch("app.api.patient_api.database")
    async def test_admin_sees_all(self, mock_db, mock_get_user):
        from app.api.patient_api import get_patients
        mock_get_user.return_value = {"id": "admin-uuid-1", "role": "admin"}
        mock_db.fetch_val = AsyncMock(return_value=10)
        mock_db.fetch_all = AsyncMock(return_value=[])

        result = await get_patients(authorization="Bearer token")
        self.assertEqual(result["total"], 10)


if __name__ == "__main__":
    unittest.main()
