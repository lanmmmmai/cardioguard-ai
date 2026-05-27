import re
from pydantic import BaseModel, EmailStr, field_validator


NAME_PATTERN = re.compile(r"^[A-Za-zÀ-ỹ]+(?:[ '\-][A-Za-zÀ-ỹ]+)+$")
PASSWORD_PATTERN = re.compile(r"^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$")


def validate_full_name(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not NAME_PATTERN.fullmatch(normalized):
        raise ValueError("Full name must contain at least two words and only letters, spaces, hyphens or apostrophes")
    return normalized


def validate_password(value: str) -> str:
    if not PASSWORD_PATTERN.fullmatch(value):
        raise ValueError("Password must be at least 8 characters and include uppercase, letters, numbers and special characters")
    return value


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
