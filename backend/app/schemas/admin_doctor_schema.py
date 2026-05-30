from pydantic import BaseModel, EmailStr, field_validator, model_validator
from datetime import datetime
from app.core.password_policy import validate_password

class DoctorCreate(BaseModel):
    full_name: str
    email: EmailStr
    phone: str | None = None
    password: str
    confirm_password: str
    specialty: str | None = None
    department: str | None = None
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
    full_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    password: str | None = None
    confirm_password: str | None = None
    specialty: str | None = None
    department: str | None = None
    status: str | None = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return validate_password(v)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in {"active", "inactive"}:
            raise ValueError("Trạng thái phải là active hoặc inactive")
        return v

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password is not None or self.confirm_password is not None:
            if self.password != self.confirm_password:
                raise ValueError("Mật khẩu xác nhận không trùng khớp")
        return self

class DoctorResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str | None = None
    specialty: str | None = None
    department: str | None = None
    status: str
    created_at: datetime | None = None
