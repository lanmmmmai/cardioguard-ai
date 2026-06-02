import re
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from app.schemas.auth_schema import validate_full_name, validate_password


PHONE_PATTERN = re.compile(r"^[0-9+() .-]{7,20}$")


def validate_optional_phone(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if not PHONE_PATTERN.fullmatch(normalized):
        raise ValueError("Phone must contain 7-20 digits or phone punctuation")
    return normalized


class UserMeUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        return validate_optional_phone(value)


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation do not match")
        return self


class PatientMeUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=0, le=130)
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    medical_history: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        return validate_optional_phone(value)

    @field_validator("gender")
    @classmethod
    def gender_format(cls, value: Optional[str]) -> Optional[str]:
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
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class UserAdminCreate(BaseModel):
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    password: str
    status: Optional[str] = "active"

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: str) -> str:
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        return validate_optional_phone(value)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return validate_password(value)

    @field_validator("role")
    @classmethod
    def role_format(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"admin", "doctor", "patient"}:
            raise ValueError("Role must be admin, doctor, or patient")
        return normalized

    @field_validator("status")
    @classmethod
    def status_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return "active"
        normalized = value.strip().lower()
        if normalized not in {"active", "inactive"}:
            raise ValueError("Status must be active or inactive")
        return normalized


class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    password: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return validate_full_name(value)

    @field_validator("phone")
    @classmethod
    def phone_format(cls, value: Optional[str]) -> Optional[str]:
        return validate_optional_phone(value)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return validate_password(value)

    @field_validator("role")
    @classmethod
    def role_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"admin", "doctor", "patient"}:
            raise ValueError("Role must be admin, doctor, or patient")
        return normalized

    @field_validator("status")
    @classmethod
    def status_format(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"active", "inactive"}:
            raise ValueError("Status must be active or inactive")
        return normalized

