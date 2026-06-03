"""Lược đồ Pydantic cho quản lý hồ sơ người dùng (tự phục vụ và quản trị).

Mục đích:
  Cung cấp các mô hình yêu cầu đã được xác thực cho:
  - Người dùng cập nhật hồ sơ của chính họ (``UserMeUpdate``).
  - Bệnh nhân cập nhật thông tin chi tiết của chính họ (``PatientMeUpdate``).
  - Thay đổi mật khẩu (``PasswordUpdate``).
  - Quản trị viên tạo / cập nhật bất kỳ tài khoản người dùng nào (``UserAdminCreate`` /
    ``UserAdminUpdate``).

Luồng công việc:
  1. Các điểm cuối tự phục vụ chấp nhận ``UserMeUpdate`` / ``PatientMeUpdate``
     và áp dụng các bộ xác thực theo trường (định dạng tên, mẫu điện thoại, liệt kê
     giới tính, cắt bỏ khoảng trắng văn bản).
  2. ``PasswordUpdate`` thực thi chính sách độ mạnh và khớp xác nhận.
  3. Các điểm cuối quản trị sử dụng ``UserAdminCreate`` / ``UserAdminUpdate`` với
     kiểm tra liệt kê vai trò và trạng thái.

Quan hệ:
  - Tái sử dụng ``validate_full_name`` và ``validate_password`` từ
    ``auth_schema`` để giữ cho các quy tắc tên / mật khẩu nhất quán.
  - Được tiêu thụ bởi các điểm cuối app.api.user_api.
"""

import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.auth_schema import validate_full_name, validate_password


# Khớp 7–20 ký tự chứa chữ số, +, (, ), ., dấu cách, dấu gạch nối
PHONE_PATTERN = re.compile(r"^[0-9+() .-]{7,20}$")


def validate_optional_phone(value: Optional[str]) -> Optional[str]:
    """Xác thực và chuẩn hóa số điện thoại tùy chọn.

    Trả về ``None`` khi đầu vào là ``None`` hoặc rỗng; nếu không thì đảm bảo
    giá trị khớp với ``PHONE_PATTERN``.
    """
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if not PHONE_PATTERN.fullmatch(normalized):
        raise ValueError("Phone must contain 7-20 digits or phone punctuation")
    return normalized


class UserMeUpdate(BaseModel):
    """Mô hình tự phục vụ để người dùng cập nhật tên và số điện thoại.

    Thuộc tính:
        full_name: Tên đầy đủ mới tùy chọn.
        phone: Số điện thoại mới tùy chọn.
    """
    full_name: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra định dạng tên đầy đủ nếu có giá trị."""
        if value is None:
            return None
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra định dạng số điện thoại tùy chọn."""
        return validate_optional_phone(value)


class PasswordUpdate(BaseModel):
    """Yêu cầu thay đổi mật khẩu của người dùng.

    Thuộc tính:
        current_password: Mật khẩu hiện tại để xác minh.
        new_password: Mật khẩu mới mong muốn (phải đáp ứng chính sách độ mạnh).
        confirm_password: Phải khớp với ``new_password``.
    """
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        """Kiểm tra độ mạnh của mật khẩu mới."""
        return validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        """Đảm bảo mật khẩu mới và xác nhận giống nhau."""
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation do not match")
        return self


class PatientMeUpdate(BaseModel):
    """Mô hình tự phục vụ để bệnh nhân cập nhật hồ sơ của họ.

    Thuộc tính:
        full_name: Tên đầy đủ mới tùy chọn.
        age: Tuổi tùy chọn (0–130).
        gender: Giới tính tùy chọn (giá trị Tiếng Việt/Tiếng Anh).
        phone: Số điện thoại tùy chọn.
        address: Địa chỉ tùy chọn.
        medical_history: Tóm tắt tiền sử bệnh án tùy chọn.
    """
    full_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra định dạng tên đầy đủ nếu có giá trị."""
        if value is None:
            return None
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra định dạng số điện thoại tùy chọn."""
        return validate_optional_phone(value)

    @field_validator("gender")
    @classmethod
    def gender_format(cls, value: Optional[str]) -> Optional[str]:
        """Xác thực giới tính phải nằm trong danh sách cho phép."""
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        if normalized not in {"Nam", "Nữ", "Khác", "Male", "Female", "Other"}:
            raise ValueError("Gender must be Nam, Nữ, Khác, Male, Female or Other")
        return normalized

    @field_validator("address", "medical_history")
    @classmethod
    def trim_optional_text(cls, value: Optional[str]) -> Optional[str]:
        """Cắt bỏ khoảng trắng từ các trường văn bản tùy chọn; trả về ``None`` cho
        chuỗi rỗng."""
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class UserAdminCreate(BaseModel):
    """Mô hình chỉ dành cho quản trị viên để tạo người dùng với toàn quyền kiểm soát
    vai trò và trạng thái.

    Thuộc tính:
        full_name: Tên đầy đủ (được xác thực về số lượng từ).
        email: Địa chỉ email.
        phone: Số điện thoại tùy chọn.
        role: Một trong ``"admin"``, ``"doctor"``, ``"patient"``.
        password: Mật khẩu dạng văn bản thuần (được xác thực về độ mạnh).
        status: ``"active"`` hoặc ``"inactive"`` (mặc định: ``"active"``).
    """
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    password: str
    status: Optional[str] = "active"

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: str) -> str:
        """Kiểm tra định dạng tên đầy đủ."""
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra định dạng số điện thoại tùy chọn."""
        return validate_optional_phone(value)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        """Kiểm tra độ mạnh của mật khẩu."""
        return validate_password(value)

    @field_validator("role")
    @classmethod
    def role_format(cls, value: str) -> str:
        """Xác thực vai trò phải là admin, doctor hoặc patient."""
        normalized = value.strip().lower()
        if normalized not in {"admin", "doctor", "patient"}:
            raise ValueError("Role must be admin, doctor, or patient")
        return normalized

    @field_validator("status")
    @classmethod
    def status_format(cls, value: Optional[str]) -> Optional[str]:
        """Xác thực trạng thái phải là active hoặc inactive."""
        if value is None:
            return "active"
        normalized = value.strip().lower()
        if normalized not in {"active", "inactive"}:
            raise ValueError("Status must be active or inactive")
        return normalized


class UserAdminUpdate(BaseModel):
    """Mô hình chỉ dành cho quản trị viên để cập nhật bất kỳ trường nào của người dùng.

    Tất cả các trường đều tùy chọn.
    """
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra định dạng tên đầy đủ nếu có giá trị."""
        if value is None:
            return None
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra định dạng số điện thoại tùy chọn."""
        return validate_optional_phone(value)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra độ mạnh mật khẩu nếu có giá trị."""
        if value is None:
            return None
        return validate_password(value)

    @field_validator("role")
    @classmethod
    def role_format(cls, value: Optional[str]) -> Optional[str]:
        """Xác thực vai trò nếu có giá trị."""
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"admin", "doctor", "patient"}:
            raise ValueError("Role must be admin, doctor, or patient")
        return normalized

    @field_validator("status")
    @classmethod
    def status_format(cls, value: Optional[str]) -> Optional[str]:
        """Xác thực trạng thái nếu có giá trị."""
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"active", "inactive"}:
            raise ValueError("Status must be active or inactive")
        return normalized
