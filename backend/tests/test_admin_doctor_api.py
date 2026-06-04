"""Unit tests for admin_doctor_api.py — doctor CRUD and verification.

Run: python -m unittest tests.test_admin_doctor_api
"""

import os, sys, unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

ADMIN_USER = {"id": "admin-1", "role": "admin", "email": "admin@test.com"}


class TestGetDoctors(unittest.IsolatedAsyncioTestCase):
    """Tests for list and get doctor endpoints."""

    @patch("app.api.admin_doctor_api.database")
    async def test_list_doctors(self, mock_db):
        from app.api.admin_doctor_api import list_doctors
        mock_db.fetch_val = AsyncMock(return_value=3)
        mock_db.fetch_all = AsyncMock(return_value=[])

        result = await list_doctors(admin=ADMIN_USER)
        self.assertEqual(result["total"], 3)

    @patch("app.api.admin_doctor_api.database")
    async def test_get_doctor_by_id(self, mock_db):
        from app.api.admin_doctor_api import get_doctor
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "doctor-uuid-1", "full_name": "Bac Si A", "email": "a@h.com",
            "status": "active", "is_verified": False,
        })

        result = await get_doctor(doctor_id="doctor-uuid-1", admin=ADMIN_USER)
        self.assertEqual(result["full_name"], "Bac Si A")


class TestCreateDoctor(unittest.IsolatedAsyncioTestCase):
    """Tests for create_doctor endpoint."""

    @patch("app.api.admin_doctor_api.database")
    async def test_create_doctor_success(self, mock_db):
        from app.api.admin_doctor_api import create_doctor
        from app.schemas.admin_doctor_schema import DoctorCreate
        mock_db.fetch_one = AsyncMock(side_effect=[
            None,  # email not taken
            {      # created user
                "id": "new-doctor-uuid", "full_name": "Bac Si A",
                "email": "a@h.com", "role": "doctor", "status": "active",
            },
        ])
        mock_db.execute = AsyncMock()

        payload = DoctorCreate(
            full_name="Bac Si A", email="a@h.com",
            password="StrongPass1!", confirm_password="StrongPass1!",
            specialty="Tim mach",
        )
        result = await create_doctor(payload=payload, admin=ADMIN_USER)
        self.assertEqual(result["full_name"], "Bac Si A")


class TestVerifyDoctor(unittest.IsolatedAsyncioTestCase):
    """Tests for doctor verification endpoints."""

    @patch("app.api.admin_doctor_api.send_doctor_status_email")
    @patch("app.api.admin_doctor_api.database")
    async def test_verify_doctor(self, mock_db, mock_email):
        from app.api.admin_doctor_api import verify_doctor
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "doctor-uuid-1", "full_name": "Bac Si A",
            "is_verified": False, "email": "a@h.com",
        })
        mock_db.execute = AsyncMock()
        mock_email.return_value = True

        result = await verify_doctor(doctor_id="doctor-uuid-1", admin=ADMIN_USER)
        self.assertIn("message", result)

    @patch("app.api.admin_doctor_api.send_doctor_status_email")
    @patch("app.api.admin_doctor_api.database")
    async def test_reject_doctor(self, mock_db, mock_email):
        from app.api.admin_doctor_api import reject_doctor
        from app.schemas.profile_schema import DoctorVerificationAction
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "doctor-uuid-1", "full_name": "Bac Si A",
            "email": "a@h.com",
        })
        mock_db.execute = AsyncMock()
        mock_email.return_value = True

        action = DoctorVerificationAction()
        result = await reject_doctor(doctor_id="doctor-uuid-1", action=action, admin=ADMIN_USER)
        self.assertIn("message", result)


if __name__ == "__main__":
    unittest.main()
