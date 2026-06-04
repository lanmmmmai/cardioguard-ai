"""Unit tests for auth_schema.py — OTP register/login/forgot/change password validation.

Run: python -m unittest tests.test_auth_schema
"""

import os, sys, unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.schemas.auth_schema import (
    RegisterOtpRequest,
    RegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    ForgotPasswordVerifyRequest,
    ChangePasswordRequest,
    GoogleLoginRequest,
    validate_full_name,
)


class TestValidateFullName(unittest.TestCase):
    """Tests for validate_full_name utility function."""

    def test_valid_two_word_name(self):
        result = validate_full_name("  Nguyen   Van A  ")
        self.assertEqual(result, "Nguyen Van A")

    def test_valid_hyphenated_name(self):
        result = validate_full_name("Tran Thi Kim-Anh")
        self.assertEqual(result, "Tran Thi Kim-Anh")

    def test_valid_vietnamese_name(self):
        result = validate_full_name("Nguyễn Văn A")
        self.assertEqual(result, "Nguyễn Văn A")

    def test_rejects_single_word(self):
        with self.assertRaises(ValueError):
            validate_full_name("John")

    def test_rejects_empty_string(self):
        with self.assertRaises(ValueError):
            validate_full_name("")

    def test_rejects_name_with_numbers(self):
        with self.assertRaises(ValueError):
            validate_full_name("Nguyen Van 123")


class TestRegisterOtpRequest(unittest.TestCase):
    """Tests for RegisterOtpRequest schema."""

    def test_valid_request_default_role(self):
        schema = RegisterOtpRequest(full_name="Nguyen Van A", email="a@example.com")
        self.assertEqual(schema.role, "patient")
        self.assertIsNone(schema.phone)

    def test_valid_request_with_doctor_role(self):
        schema = RegisterOtpRequest(full_name="Bac Si A", email="b@example.com", role="doctor")
        self.assertEqual(schema.role, "doctor")

    def test_invalid_name_rejected(self):
        with self.assertRaises(ValueError):
            RegisterOtpRequest(full_name="John", email="a@example.com")

    def test_invalid_email_rejected(self):
        with self.assertRaises(ValueError):
            RegisterOtpRequest(full_name="Nguyen Van A", email="not-an-email")


class TestRegisterRequest(unittest.TestCase):
    """Tests for RegisterRequest schema — full OTP registration."""

    def test_valid_request(self):
        schema = RegisterRequest(
            full_name="Nguyen Van A",
            email="a@example.com",
            password="StrongPass1!",
            otp="123456",
        )
        self.assertEqual(schema.otp, "123456")

    def test_weak_password_rejected(self):
        with self.assertRaises(ValueError):
            RegisterRequest(
                full_name="Nguyen Van A",
                email="a@example.com",
                password="weak",
                otp="123456",
            )

    def test_invalid_otp_not_6_digits(self):
        with self.assertRaises(ValueError):
            RegisterRequest(
                full_name="Nguyen Van A",
                email="a@example.com",
                password="StrongPass1!",
                otp="12345",
            )

    def test_invalid_otp_has_letters(self):
        with self.assertRaises(ValueError):
            RegisterRequest(
                full_name="Nguyen Van A",
                email="a@example.com",
                password="StrongPass1!",
                otp="abc123",
            )

    def test_invalid_otp_empty(self):
        with self.assertRaises(ValueError):
            RegisterRequest(
                full_name="Nguyen Van A",
                email="a@example.com",
                password="StrongPass1!",
                otp="",
            )


class TestLoginRequest(unittest.TestCase):
    """Tests for LoginRequest schema."""

    def test_valid_minimal(self):
        schema = LoginRequest(email="a@example.com", password="mypass")
        self.assertIsNone(schema.expected_role)

    def test_valid_with_expected_role(self):
        schema = LoginRequest(email="a@example.com", password="mypass", expected_role="doctor")
        self.assertEqual(schema.expected_role, "doctor")


class TestForgotPasswordRequest(unittest.TestCase):
    """Tests for ForgotPasswordRequest schema."""

    def test_valid_email(self):
        schema = ForgotPasswordRequest(email="a@example.com")
        self.assertEqual(schema.email, "a@example.com")

    def test_invalid_email_rejected(self):
        with self.assertRaises(ValueError):
            ForgotPasswordRequest(email="not-email")


class TestForgotPasswordVerifyRequest(unittest.TestCase):
    """Tests for ForgotPasswordVerifyRequest schema."""

    def test_valid_without_new_password(self):
        schema = ForgotPasswordVerifyRequest(email="a@example.com", otp="123456")
        self.assertIsNone(schema.new_password)

    def test_valid_with_new_password(self):
        schema = ForgotPasswordVerifyRequest(
            email="a@example.com", otp="123456", new_password="NewStrong1!"
        )
        self.assertEqual(schema.new_password, "NewStrong1!")

    def test_invalid_otp_rejected(self):
        with self.assertRaises(ValueError):
            ForgotPasswordVerifyRequest(email="a@example.com", otp="ab1")

    def test_weak_new_password_rejected(self):
        with self.assertRaises(ValueError):
            ForgotPasswordVerifyRequest(
                email="a@example.com", otp="123456", new_password="weak"
            )


class TestChangePasswordRequest(unittest.TestCase):
    """Tests for ChangePasswordRequest schema."""

    def test_valid_change(self):
        schema = ChangePasswordRequest(old_password="OldPass1!", new_password="NewPass1!")
        self.assertEqual(schema.old_password, "OldPass1!")

    def test_rejects_same_password(self):
        with self.assertRaises(ValueError):
            ChangePasswordRequest(old_password="SamePass1!", new_password="SamePass1!")

    def test_weak_new_password_rejected(self):
        with self.assertRaises(ValueError):
            ChangePasswordRequest(old_password="OldPass1!", new_password="weak")


class TestGoogleLoginRequest(unittest.TestCase):
    """Tests for GoogleLoginRequest schema."""

    def test_valid_minimal(self):
        schema = GoogleLoginRequest(
            id_token="token",
            email="a@gmail.com",
            full_name="Nguyen Van A",
            google_id="g123",
        )
        self.assertEqual(schema.role, "patient")

    def test_valid_with_optional_fields(self):
        schema = GoogleLoginRequest(
            id_token="token",
            email="a@gmail.com",
            full_name="Nguyen Van A",
            google_id="g123",
            avatar_url="https://example.com/avatar.jpg",
            role="doctor",
        )
        self.assertEqual(schema.role, "doctor")
        self.assertEqual(schema.avatar_url, "https://example.com/avatar.jpg")


if __name__ == "__main__":
    unittest.main()
