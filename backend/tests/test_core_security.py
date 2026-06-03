"""Kiểm thử đơn vị cho các tiện ích bảo mật cốt lõi — chính sách mật khẩu và mã thông báo JWT.

Mục đích:
  Xác minh rằng logic xác thực mật khẩu và các hàm trợ giúp bảo mật
  (băm, xác minh, tạo JWT) hoạt động như mong đợi.

Luồng công việc:
  1. Đặt các biến môi trường cần thiết cho ứng dụng trước khi nhập mô-đun.
  2. ``TestPasswordPolicy`` — đảm bảo mật khẩu mạnh vượt qua xác thực và
     mật khẩu yếu gây ra ``ValueError``.
  3. ``TestSecurityHelpers`` — kiểm tra rằng băm mật khẩu là không thể đảo ngược
     nhưng có thể xác minh được, và ``create_access_token`` tạo ra một
     JWT ba phần hợp lệ.

Quan hệ:
  - app.core.password_policy — trình xác thực độ mạnh.
  - app.core.security — hash_password, verify_password, create_access_token.
"""

import unittest
import os

# Đặt các biến môi trường chỉ dành cho kiểm thử trước khi bất kỳ mô-đun ứng dụng nào được nhập để
# các cài đặt được khởi tạo chính xác.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.core.password_policy import validate_password
from app.core.security import create_access_token, hash_password, verify_password


class TestPasswordPolicy(unittest.TestCase):
    """Xác thực trình xác thực độ mạnh mật khẩu."""

    def test_validate_password_accepts_strong_password(self):
        """Mật khẩu đáp ứng tất cả các quy tắc chính sách sẽ được thông qua mà không thay đổi."""
        value = "StrongPass1!"
        self.assertEqual(validate_password(value), value)

    def test_validate_password_rejects_weak_password(self):
        """Mật khẩu không đáp ứng các quy tắc chính sách sẽ gây ra ``ValueError``."""
        with self.assertRaises(ValueError):
            validate_password("weakpass")


class TestSecurityHelpers(unittest.TestCase):
    """Xác thực băm mật khẩu và tạo mã thông báo JWT."""

    def test_hash_and_verify_password(self):
        """Mật khẩu đã băm không được bằng giá trị thô, nhưng phải xác minh
        chính xác với bản gốc và từ chối mật khẩu khác."""
        raw = "StrongPass1!"
        hashed = hash_password(raw)
        self.assertNotEqual(raw, hashed)
        self.assertTrue(verify_password(raw, hashed))
        self.assertFalse(verify_password("WrongPass1!", hashed))

    def test_create_access_token_returns_jwt(self):
        """Mã thông báo phải là một chuỗi chứa chính xác hai dấu chấm (ba
        đoạn được mã hóa base64)."""
        token = create_access_token({"sub": "user-1", "role": "patient"})
        self.assertIsInstance(token, str)
        self.assertEqual(token.count("."), 2)


if __name__ == "__main__":
    unittest.main()
