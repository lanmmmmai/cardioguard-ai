"""Kiểm thử đơn vị cho Dịch vụ OTP (otp_service.py).

Đường dẫn: backend/tests/test_otp_rules.py
"""

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import AsyncMock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Thiết lập các biến môi trường giả lập
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.services.otp_service import (
    generate_otp,
    hash_otp,
    parse_metadata,
    create_otp_token,
    verify_otp_token,
    invalidate_otp_tokens,
    consume_otp_token,
)


class TestOtpService(unittest.IsolatedAsyncioTestCase):
    """Bộ kiểm thử cho các hàm tiện ích và logic nghiệp vụ OTP."""

    def test_generate_otp_returns_six_digit_string(self):
        """Đảm bảo generate_otp tạo chuỗi 6 chữ số hợp lệ."""
        otp = generate_otp()
        self.assertIsInstance(otp, str)
        self.assertEqual(len(otp), 6)
        self.assertTrue(otp.isdigit())

    def test_hash_otp_is_deterministic(self):
        """Băm OTP phải nhất quán với cùng tham số đầu vào và khoá bí mật."""
        purpose = "register"
        email = "Test@CardioGuard.ai"
        otp = "123456"

        hash1 = hash_otp(purpose, email, otp)
        hash2 = hash_otp(purpose, email, otp)
        self.assertEqual(hash1, hash2)

        # Đảm bảo email viết hoa hay viết thường đều băm ra cùng kết quả
        hash3 = hash_otp(purpose, email.lower(), otp)
        self.assertEqual(hash1, hash3)

        # Băm khác đi nếu thay đổi tham số
        hash_diff = hash_otp("forgot_password", email, otp)
        self.assertNotEqual(hash1, hash_diff)

    def test_parse_metadata_safely(self):
        """Xác thực hàm phân tích siêu dữ liệu xử lý an toàn mọi kiểu dữ liệu đầu vào."""
        self.assertEqual(parse_metadata({"key": "val"}), {"key": "val"})
        self.assertEqual(parse_metadata(None), {})
        self.assertEqual(parse_metadata('{"user_id": 123}'), {"user_id": 123})
        self.assertEqual(parse_metadata('invalid-json-string'), {})

    @patch("app.services.otp_service.database")
    async def test_create_otp_token_inserts_successfully(self, mock_db):
        """Tạo mới OTP chèn thông tin chính xác vào DB và trả về OTP 6 chữ số."""
        mock_db.execute = AsyncMock()
        
        # Mở giao dịch transaction
        mock_transaction = AsyncMock()
        mock_db.transaction.return_value.__aenter__ = AsyncMock(return_value=mock_transaction)
        mock_db.transaction.return_value.__aexit__ = AsyncMock()

        otp = await create_otp_token(purpose="register", email="patient@cardioguard.ai")

        self.assertEqual(len(otp), 6)
        # 2 execute: 1 update các otp cũ, 1 insert otp mới
        self.assertEqual(mock_db.execute.call_count, 2)

        # Xác thực các đối số insert
        insert_args = mock_db.execute.call_args_list[1][0]
        self.assertIn("INSERT INTO auth_otp_tokens", insert_args[0])
        self.assertEqual(insert_args[1]["purpose"], "register")
        self.assertEqual(insert_args[1]["email"], "patient@cardioguard.ai")

    @patch("app.services.otp_service.database")
    async def test_verify_otp_token_success(self, mock_db):
        """Xác thực verify_otp_token thành công khi OTP trùng khớp."""
        purpose = "register"
        email = "patient@cardioguard.ai"
        otp = "123456"
        stored_hash = hash_otp(purpose, email, otp)

        mock_db.fetch_one = AsyncMock(side_effect=[
            { # 1. Trả về thông tin OTP trong bảng
                "id": "token-uuid-1",
                "otp_hash": stored_hash,
                "metadata": '{"name": "Nguyen Van A"}',
                "attempts": 0,
                "max_attempts": 5,
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
            },
            { # 2. Trả về metadata khi update consumed_at thành công
                "metadata": '{"name": "Nguyen Van A"}',
            }
        ])

        result = await verify_otp_token(purpose=purpose, email=email, otp=otp)
        self.assertTrue(result.is_valid)
        self.assertEqual(result.reason, "valid")
        self.assertEqual(result.metadata["name"], "Nguyen Van A")

    @patch("app.services.otp_service.database")
    async def test_verify_otp_token_expired(self, mock_db):
        """OTP hết hạn phải trả về kết quả không hợp lệ (reason = expired) và đánh dấu consumed."""
        purpose = "register"
        email = "patient@cardioguard.ai"
        otp = "123456"

        mock_db.fetch_one = AsyncMock(return_value={
            "id": "token-uuid-1",
            "otp_hash": "some-hash",
            "metadata": "{}",
            "attempts": 0,
            "max_attempts": 5,
            "expires_at": datetime.now(timezone.utc) - timedelta(minutes=5), # Hết hạn từ 5 phút trước
        })
        mock_db.execute = AsyncMock()

        result = await verify_otp_token(purpose=purpose, email=email, otp=otp)
        self.assertFalse(result.is_valid)
        self.assertEqual(result.reason, "expired")
        mock_db.execute.assert_called_once()
        self.assertIn("UPDATE auth_otp_tokens SET consumed_at = NOW()", mock_db.execute.call_args[0][0])

    @patch("app.services.otp_service.database")
    async def test_verify_otp_token_incorrect_increments_attempts(self, mock_db):
        """OTP sai sẽ tăng số lần thử. Nếu đạt giới hạn max_attempts thì vô hiệu hóa OTP."""
        purpose = "register"
        email = "patient@cardioguard.ai"
        otp_wrong = "000000"

        mock_db.fetch_one = AsyncMock(return_value={
            "id": "token-uuid-1",
            "otp_hash": hash_otp(purpose, email, "123456"),
            "metadata": "{}",
            "attempts": 4, # Đã thử sai 4 lần
            "max_attempts": 5,
            "expires_at": datetime.now(timezone.utc) + timedelta(minutes=5),
        })
        mock_db.execute = AsyncMock()

        result = await verify_otp_token(purpose=purpose, email=email, otp=otp_wrong)
        self.assertFalse(result.is_valid)
        self.assertEqual(result.reason, "invalid")
        
        # Đảm bảo có gọi query tăng attempts + consumed_at
        mock_db.execute.assert_called_once()
        update_query = mock_db.execute.call_args[0][0]
        self.assertIn("attempts = attempts + 1", update_query)
        self.assertIn("consumed_at = CASE", update_query)


if __name__ == "__main__":
    unittest.main()
