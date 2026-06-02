import re
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.core.password_policy import validate_password


NAME_PATTERN = re.compile(r"^[A-Za-zÀ-ỹ]+(?:[ '\-][A-Za-zÀ-ỹ]+)+$")


def validate_full_name(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not NAME_PATTERN.fullmatch(normalized):
        raise ValueError("Full name must contain at least two words and only letters, spaces, hyphens or apostrophes")
    return normalized


class RegisterOtpRequest(BaseModel):
    full_name: str
    email: EmailStr

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: str) -> str:
        return validate_full_name(value)


class RegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    otp: str

    @field_validator("full_name")
    @classmethod
    def full_name_format(cls, value: str) -> str:
        return validate_full_name(value)

    @field_validator("password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return validate_password(value)

    @field_validator("otp")
    @classmethod
    def otp_format(cls, value: str) -> str:
        if not re.fullmatch(r"\d{6}", value.strip()):
            raise ValueError("OTP must be 6 digits")
        return value.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordVerifyRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: Optional[str] = None

    @field_validator("otp")
    @classmethod
    def otp_format(cls, value: str) -> str:
        if not re.fullmatch(r"\d{6}", value.strip()):
            raise ValueError("OTP must be 6 digits")
        return value.strip()

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return validate_password(value)


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, value: str) -> str:
        return validate_password(value)

    @model_validator(mode="after")
    def passwords_match(self) -> 'ChangePasswordRequest':
        if self.new_password == self.old_password:
            raise ValueError("New password must be different from old password")
        return self
