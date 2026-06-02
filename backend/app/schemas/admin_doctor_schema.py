from pydantic import BaseModel, EmailStr, field_validator, model_validator
from datetime import datetime
from typing import Optional
from app.core.password_policy import validate_password


class DoctorCreate(BaseModel):
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
        return validate_password(v)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in {"active", "inactive"}:
            raise ValueError("Trạng thái phải là active hoặc inactive")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Mật khẩu xác nhận không trùng khớp")
        return self


class DoctorUpdate(BaseModel):
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
        if v is None:
            return None
        return validate_password(v)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in {"active", "inactive"}:
            raise ValueError("Trạng thái phải là active hoặc inactive")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password is not None or self.confirm_password is not None:
            if self.password != self.confirm_password:
                raise ValueError("Mật khẩu xác nhận không trùng khớp")
        return self


from datetime import date

class DoctorResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    specialty: Optional[str] = None
    department: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    position: Optional[str] = None
    experience_years: Optional[int] = None
    license_number: Optional[str] = None
    license_issued_date: Optional[date] = None
    license_issued_by: Optional[str] = None
    license_certificate_url: Optional[str] = None
    cccd_front_url: Optional[str] = None
    cccd_back_url: Optional[str] = None
    is_verified: Optional[bool] = None
    verification_note: Optional[str] = None
