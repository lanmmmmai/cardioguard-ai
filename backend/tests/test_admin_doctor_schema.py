"""Unit tests for admin_doctor_schema.py — DoctorCreate, DoctorUpdate, DoctorResponse.

Run: python -m unittest tests.test_admin_doctor_schema
"""

import os, sys, unittest
from pathlib import Path
from datetime import datetime, date

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.schemas.admin_doctor_schema import (
    DoctorCreate,
    DoctorUpdate,
    DoctorResponse,
    PaginatedDoctorResponse,
)


class TestDoctorCreate(unittest.TestCase):
    """Tests for DoctorCreate schema."""

    def test_valid_create(self):
        schema = DoctorCreate(
            full_name="Bac Si A",
            email="a@hospital.com",
            password="StrongPass1!",
            confirm_password="StrongPass1!",
            specialty="Tim mach",
        )
        self.assertEqual(schema.full_name, "Bac Si A")
        self.assertEqual(schema.specialty, "Tim mach")
        self.assertEqual(schema.status, "active")

    def test_password_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            DoctorCreate(
                full_name="Bac Si A",
                email="a@hospital.com",
                password="StrongPass1!",
                confirm_password="DifferentPass1!",
            )

    def test_weak_password_rejected(self):
        with self.assertRaises(ValueError):
            DoctorCreate(
                full_name="Bac Si A",
                email="a@hospital.com",
                password="weak",
                confirm_password="weak",
            )

    def test_invalid_status_rejected(self):
        with self.assertRaises(ValueError):
            DoctorCreate(
                full_name="Bac Si A",
                email="a@hospital.com",
                password="StrongPass1!",
                confirm_password="StrongPass1!",
                status="deleted",
            )


class TestDoctorUpdate(unittest.TestCase):
    """Tests for DoctorUpdate schema."""

    def test_empty_update_allowed(self):
        schema = DoctorUpdate()
        self.assertIsNone(schema.full_name)

    def test_valid_partial_update(self):
        schema = DoctorUpdate(specialty="Noi khoa", status="active")
        self.assertEqual(schema.specialty, "Noi khoa")

    def test_invalid_status_rejected(self):
        with self.assertRaises(ValueError):
            DoctorUpdate(status="suspended")

    def test_password_fields_mismatch_rejected(self):
        with self.assertRaises(ValueError):
            DoctorUpdate(password="NewPass1!", confirm_password="OtherPass1!")

    def test_password_both_none_ok(self):
        schema = DoctorUpdate(full_name="Bac Si B")
        self.assertEqual(schema.full_name, "Bac Si B")


class TestDoctorResponse(unittest.TestCase):
    """Tests for DoctorResponse schema."""

    def test_valid_response(self):
        schema = DoctorResponse(
            id="550e8400-e29b-41d4-a716-446655440000",
            full_name="Bac Si A",
            email="a@hospital.com",
            status="active",
        )
        self.assertEqual(schema.full_name, "Bac Si A")
        self.assertIsNone(schema.specialty)

    def test_full_response(self):
        schema = DoctorResponse(
            id="550e8400-e29b-41d4-a716-446655440000",
            full_name="Bac Si A",
            email="a@hospital.com",
            status="active",
            specialty="Tim mach",
            is_verified=True,
            experience_years=15,
        )
        self.assertTrue(schema.is_verified)
        self.assertEqual(schema.experience_years, 15)


class TestPaginatedDoctorResponse(unittest.TestCase):
    """Tests for PaginatedDoctorResponse schema."""

    def test_valid_paginated(self):
        schema = PaginatedDoctorResponse(
            items=[],
            total=0,
            limit=20,
            offset=0,
        )
        self.assertEqual(schema.total, 0)
        self.assertEqual(schema.limit, 20)

    def test_with_doctor_items(self):
        doctor = DoctorResponse(
            id="550e8400-e29b-41d4-a716-446655440000",
            full_name="Bac Si A",
            email="a@hospital.com",
            status="active",
        )
        schema = PaginatedDoctorResponse(
            items=[doctor],
            total=1,
            limit=10,
            offset=0,
        )
        self.assertEqual(len(schema.items), 1)
        self.assertEqual(schema.items[0].full_name, "Bac Si A")


if __name__ == "__main__":
    unittest.main()
