import unittest
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.core.password_policy import validate_password
from app.core.security import create_access_token, hash_password, verify_password


class TestPasswordPolicy(unittest.TestCase):
    def test_validate_password_accepts_strong_password(self):
        value = "StrongPass1!"
        self.assertEqual(validate_password(value), value)

    def test_validate_password_rejects_weak_password(self):
        with self.assertRaises(ValueError):
            validate_password("weakpass")


class TestSecurityHelpers(unittest.TestCase):
    def test_hash_and_verify_password(self):
        raw = "StrongPass1!"
        hashed = hash_password(raw)
        self.assertNotEqual(raw, hashed)
        self.assertTrue(verify_password(raw, hashed))
        self.assertFalse(verify_password("WrongPass1!", hashed))

    def test_create_access_token_returns_jwt(self):
        token = create_access_token({"sub": "user-1", "role": "patient"})
        self.assertIsInstance(token, str)
        self.assertEqual(token.count("."), 2)


if __name__ == "__main__":
    unittest.main()
