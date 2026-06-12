"""Lược đồ Pydantic cho các luồng xác thực và quản lý tài khoản.

Mục đích:
  Định nghĩa các mô hình yêu cầu/phản hồi cho việc đăng ký dựa trên OTP,
  đăng nhập, đặt lại mật khẩu và thay đổi mật khẩu. Bao gồm kiểm tra
  hợp lý chéo trường cho định dạng tên, chính sách mật khẩu và độ dài chữ số OTP.

Luồng công việc:
  1. Máy khách gửi ``RegisterOtpRequest`` để kích hoạt email OTP.
  2. Sau khi nhận OTP, máy khách gửi ``RegisterRequest`` với
     email, mật khẩu và OTP để hoàn tất đăng ký.
  3. ``LoginRequest`` được sử dụng để đăng nhập dựa trên thông tin xác thực.
  4. ``ForgotPasswordRequest`` / ``ForgotPasswordVerifyRequest`` xử lý
     luồng đặt lại (yêu cầu OTP → xác minh OTP + đặt mật khẩu mới).
  5. ``ChangePasswordRequest`` xác thực rằng mật khẩu mới khác với
     mật khẩu cũ.

Quan hệ:
  - app.core.password_policy — xác thực độ mạnh mật khẩu tập trung.
  - Được gọi bởi các điểm cuối app.api.auth_api.
"""

import re
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.core.password_policy import validate_password


# Biểu thức chính quy: ít nhất hai từ bao gồm các ký tự Latin / Việt Nam,
# được phân cách bởi dấu cách, dấu gạch nối hoặc dấu nháy đơn.
NAME_PATTERN = re.compile(r"^[A-Za-zÀ-ỹ]+(?:[ '\-][A-Za-zÀ-ỹ]+)+$")


def validate_full_name(value: str) -> str:
    """Chuẩn hóa khoảng trắng và kiểm tra tên khớp với mẫu cặp từ.

    Args:
        value: Chuỗi tên đầy đủ thô.

    Returns:
        Tên đã được chuẩn hóa (một dấu cách).

    Raises:
        ValueError: Nếu tên không chứa ít nhất hai từ hoặc sử dụng
            ký tự không được phép.
    """
    normalized = " ".join(value.strip().split())
    if not NAME_PATTERN.fullmatch(normalized):
        raise ValueError("Full name must contain at least two words and only letters, spaces, hyphens or apostrophes")
    return normalized


class RegisterOtpRequest(BaseModel):
    """Yêu cầu gửi OTP đăng ký đến email đã cho.

    Thuộc tính:
        full_name: Tên đầy đủ của người dùng (được kiểm tra bởi ``validate_full_name``).
        email: Địa chỉ email đích.
    """
    full_name: str
    email: EmailStr
    role: Optional[str] = "patient"
    phone: Optional[str] = None
    specialty: Optional[str] = None
    department: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: str) -> str:
        """Kiểm tra định dạng tên đầy đủ."""
        return validate_full_name(value)


class RegisterRequest(BaseModel):
    """Tải trọng đăng ký hoàn chỉnh bao gồm OTP nhận được qua email.

    Thuộc tính:
        full_name: Tên đầy đủ đã được kiểm tra.
        email: Địa chỉ email (phải khớp với yêu cầu OTP).
        password: Mật khẩu dạng văn bản thuần (được kiểm tra theo chính sách).
        otp: Mã số gồm 6 chữ số.
    """
    full_name: str
    email: EmailStr
    password: str
    otp: str
    role: Optional[str] = "patient"
    phone: Optional[str] = None
    specialty: Optional[str] = None
    department: Optional[str] = None
    agree_privacy: Optional[bool] = False
    agree_terms: Optional[bool] = False
    consent_version: Optional[str] = "1.0"

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: str) -> str:
        """Kiểm tra định dạng tên đầy đủ."""
        return validate_full_name(value)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        """Kiểm tra độ mạnh của mật khẩu."""
        return validate_password(value)

    @field_validator("otp")
    @classmethod
    def otp_format(cls, value: str) -> str:
        """Kiểm tra OTP phải đúng 6 chữ số."""
        if not re.fullmatch(r"\d{6}", value.strip()):
            raise ValueError("OTP must be 6 digits")
        return value.strip()


class LoginRequest(BaseModel):
    """Thông tin xác thực cho đăng nhập người dùng.

    Thuộc tính:
        email: Địa chỉ email đã đăng ký.
        password: Mật khẩu dạng văn bản thuần.
    """
    email: EmailStr
    password: str
    expected_role: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    """Yêu cầu OTP để đặt lại mật khẩu cho email đã cho.

    Thuộc tính:
        email: Địa chỉ email của tài khoản.
    """
    email: EmailStr


class ForgotPasswordVerifyRequest(BaseModel):
    """Xác minh OTP đặt lại mật khẩu và tùy chọn đặt mật khẩu mới.

    Thuộc tính:
        email: Địa chỉ email của tài khoản.
        otp: Mã 6 chữ số nhận được qua email.
        new_password: Mật khẩu mới tùy chọn (bắt buộc nếu hành động là
            đặt mật khẩu; có thể bỏ qua nếu chỉ xác minh OTP).
    """
    email: EmailStr
    otp: str
    new_password: Optional[str] = None

    @field_validator("otp")
    @classmethod
    def otp_format(cls, value: str) -> str:
        """Kiểm tra OTP phải đúng 6 chữ số."""
        if not re.fullmatch(r"\d{6}", value.strip()):
            raise ValueError("OTP must be 6 digits")
        return value.strip()

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra độ mạnh mật khẩu mới nếu có giá trị."""
        if value is None:
            return None
        return validate_password(value)


class ChangePasswordRequest(BaseModel):
    """Yêu cầu thay đổi mật khẩu dựa trên thông tin xác thực hiện tại.

    Thuộc tính:
        old_password: Mật khẩu hiện tại của người dùng.
        new_password: Mật khẩu mới mong muốn (phải khác với mật khẩu cũ).
    """
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        """Kiểm tra độ mạnh của mật khẩu mới."""
        return validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self) -> 'ChangePasswordRequest':
        """Đảm bảo mật khẩu mới khác với mật khẩu cũ."""
        if self.new_password == self.old_password:
            raise ValueError("New password must be different from old password")
        return self


class GoogleLoginRequest(BaseModel):
    """Thông tin xác thực cho đăng nhập bằng Google.

    Thuộc tính:
        id_token: JWT do Google phát hành sau khi xác thực.
        email: Địa chỉ email từ Google, giữ lại để tương thích ngược.
        full_name: Tên đầy đủ từ Google, giữ lại để tương thích ngược.
        google_id: ID định danh từ Google, giữ lại để tương thích ngược.
        avatar_url: Đường dẫn ảnh đại diện tùy chọn.
        role: Vai trò đăng nhập mong muốn, không còn được tin cậy từ client.
    """
    id_token: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[str] = "patient"


class FacebookLoginRequest(BaseModel):
    """Thông tin xác thực cho đăng nhập bằng Facebook.

    Thuộc tính:
        access_token: Access token do Facebook JS SDK trả về sau khi người dùng đăng nhập.
        role: Vai trò đăng nhập mong muốn ('patient' | 'doctor' | 'admin').
        full_name: Tên đầy đủ tùy chọn (từ client, không tin tưởng hoàn toàn).
        avatar_url: URL ảnh đại diện tùy chọn.
    """
    access_token: str
    role: Optional[str] = "patient"
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
