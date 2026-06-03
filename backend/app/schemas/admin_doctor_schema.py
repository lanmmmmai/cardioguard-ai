"""Lược đồ Pydantic cho các điểm cuối quản lý quản trị viên và bác sĩ.

Mục đích:
  Định nghĩa các mô hình yêu cầu/phản hồi cho việc tạo, cập nhật và đọc hồ sơ
  bác sĩ. Bao gồm kiểm tra tính hợp lệ ở cấp độ trường cho độ mạnh mật khẩu,
  giá trị trạng thái và sự khớp nhau của mật khẩu xác nhận.

Luồng công việc:
  1. ``DoctorCreate`` — xác thực rằng mật khẩu đáp ứng chính sách, trạng thái là
     ``"active"`` / ``"inactive"``, và mật khẩu == confirm_password.
  2. ``DoctorUpdate`` — cùng quy tắc nhưng tất cả các trường đều tùy chọn.
  3. ``DoctorResponse`` — mô hình đầu ra chỉ đọc với created_at.

Quan hệ:
  - app.core.password_policy — được tái sử dụng để kiểm tra độ mạnh mật khẩu.
"""

from pydantic import BaseModel, EmailStr, field_validator, model_validator
from datetime import datetime
from typing import Optional
from app.core.password_policy import validate_password


class DoctorCreate(BaseModel):
    """Mô hình yêu cầu để tạo một tài khoản bác sĩ mới.

    Thuộc tính:
        full_name: Tên hiển thị của bác sĩ.
        email: Địa chỉ email hợp lệ.
        phone: Số điện thoại liên hệ tùy chọn.
        password: Mật khẩu dạng văn bản thuần (được kiểm tra độ mạnh).
        confirm_password: Phải khớp với ``password``.
        specialty: Chuyên khoa y tế (ví dụ: Tim mạch).
        department: Khoa trong bệnh viện.
        status: ``"active"`` hoặc ``"inactive"``.
    """
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    confirm_password: str
    specialty: Optional[str] = None
    department: Optional[str] = None
    status: str = "active"

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        """Kiểm tra độ mạnh của mật khẩu thông qua hàm validate_password."""
        return validate_password(v)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Xác thực rằng trạng thái chỉ là active hoặc inactive."""
        if v not in {"active", "inactive"}:
            raise ValueError("Trạng thái phải là active hoặc inactive")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        """Kiểm tra rằng mật khẩu và mật khẩu xác nhận phải giống nhau."""
        if self.password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không trùng khớp")
        return self


class DoctorUpdate(BaseModel):
    """Mô hình yêu cầu để cập nhật một phần thông tin bác sĩ hiện có.

    Tất cả các trường đều tùy chọn; chỉ những trường được cung cấp mới được áp dụng.
    """
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    confirm_password: Optional[str] = None
    specialty: Optional[str] = None
    department: Optional[str] = None
    status: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: Optional[str]) -> Optional[str]:
        """Kiểm tra độ mạnh mật khẩu nếu có giá trị."""
        if v is None:
            return None
        return validate_password(v)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Xác thực trạng thái nếu có giá trị."""
        if v is not None and v not in {"active", "inactive"}:
            raise ValueError("Trạng thái phải là active hoặc inactive")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        """Kiểm tra mật khẩu khớp nếu một trong hai trường được cung cấp."""
        if self.password is not None or self.confirm_password is not None:
            if self.password != self.confirm_password:
                raise ValueError("Mật khẩu xác nhận không trùng khớp")
        return self


class DoctorResponse(BaseModel):
    """Mô hình phản hồi chỉ đọc cho dữ liệu bác sĩ được trả về bởi API."""
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    specialty: Optional[str] = None
    department: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
