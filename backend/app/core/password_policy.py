"""Xác thực chính sách mật khẩu.

MỤC ĐÍCH:
    Thực thi các yêu cầu về độ mạnh của mật khẩu (độ dài, loại ký tự)
    phù hợp với giới hạn đầu vào 72 byte của bcrypt và hướng dẫn OWASP.

LUỒNG XỬ LÝ:
    1. Kiểm tra mật khẩu nằm trong giới hạn 72 byte của bcrypt.
    2. Xác thực bằng regex: chữ hoa, chữ thường, chữ số, ký tự đặc biệt.

QUAN HỆ:
    - Được sử dụng bởi: auth_api (điểm cuối đăng ký/đổi mật khẩu),
                       user_api (tạo người dùng bởi quản trị viên)
"""

import re


# Mẫu regex kiểm tra mật khẩu: có chữ hoa, có chữ cái, có chữ số, có ký tự đặc biệt, độ dài 8-72
PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$")
PASSWORD_POLICY_MESSAGE = (
    "Mật khẩu phải có độ dài từ 8 đến 72 ký tự và bao gồm chữ hoa, chữ cái, chữ số và ký tự đặc biệt"
)
COMMON_PASSWORDS = {
    "password",
    "password1",
    "password123",
    "admin123",
    "qwerty123",
    "12345678",
    "123456789",
    "letmein123",
    "welcome123",
    "abc12345",
}


def validate_password(value: str) -> str:
    """Xác thực mật khẩu theo chính sách bảo mật.

    Tham số:
        value: Chuỗi mật khẩu cần xác thực.

    Trả về:
        Chuỗi mật khẩu đã được xác thực nếu vượt qua tất cả kiểm tra.

    Ngoại lệ:
        ValueError: Nếu mật khẩu vượt quá 72 byte hoặc không đáp ứng yêu cầu mẫu.
    """
    normalized_candidate = re.sub(r"[^a-z0-9]", "", value.strip().lower())
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Mật khẩu không được dài quá 72 byte do hạn chế băm bảo mật")
    if normalized_candidate in COMMON_PASSWORDS:
        raise ValueError("Mật khẩu quá phổ biến và không được phép sử dụng")
    if not PASSWORD_PATTERN.fullmatch(value):
        raise ValueError(PASSWORD_POLICY_MESSAGE)
    return value
