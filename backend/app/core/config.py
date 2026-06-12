"""Mô-đun cấu hình ứng dụng.

MỤC ĐÍCH:
    Quản lý cấu hình tập trung sử dụng Pydantic Settings.
    Tải các biến môi trường từ tệp .env và cung cấp
    truy cập có kiểu dữ liệu cho tất cả cài đặt ứng dụng.

LUỒNG XỬ LÝ:
    1. Lớp Settings đọc từ các tệp env (.env gốc, backend/.env)
    2. Xác thực các trường bắt buộc (SECRET_KEY tối thiểu 32 ký tự, không mặc định)
    3. Xuất thể hiện `settings` singleton dùng chung toàn ứng dụng

QUAN HỆ:
    - Được sử dụng bởi: tất cả mô-đun backend (database, security, services, API)
    - Đọc từ: .env và backend/.env
"""

import os
from pathlib import Path
from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def resolve_base_dir() -> Path:
    """Xác định thư mục gốc dự án một cách bền vững hơn."""
    configured_root = os.getenv("CARDIOGUARD_BASE_DIR")
    if configured_root:
        return Path(configured_root).resolve()

    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "backend").exists() and (parent / "web_frontend").exists():
            return parent
    return current.parents[3]


BASE_DIR = resolve_base_dir()


class Settings(BaseSettings):
    """Cài đặt ứng dụng được tải từ các biến môi trường.

    Thuộc tính:
        ENVIRONMENT: Môi trường triển khai (development/production).
        DATABASE_URL: Chuỗi kết nối PostgreSQL.
        BREVO_API_KEY: Khóa API Brevo (Sendinblue) cho email giao dịch.
        SMTP_*: Cấu hình máy chủ SMTP để gửi email.
        OPENAI_API_KEY: Khóa API OpenAI cho tính năng chatbot AI.
        IOT_DEVICE_SHARED_TOKEN: Mã bí mật dùng chung để xác thực thiết bị IoT.
        SECRET_KEY: Mã bí mật ký JWT (tối thiểu 32 ký tự, không được mặc định).
        ACCESS_TOKEN_EXPIRE_MINUTES: Thời gian sống của token JWT truy cập (phút).
        EXPOSE_DEV_OTP: Nếu True, trả về OTP trong phản hồi API cho môi trường phát triển.
    """
    ENVIRONMENT: str = "development"
    DATABASE_URL: str
    REDIS_URL: str = ""
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str = ""
    BREVO_API_KEY: str = ""
    EMAIL_FROM_EMAIL: str = "noreply@giatky.site"
    EMAIL_FROM_NAME: str = "CardioGuard AI"
    GOOGLE_CLIENT_ID: str = ""
    FACEBOOK_APP_ID: str = ""
    FACEBOOK_APP_SECRET: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = ""
    SMTP_FROM_EMAIL: str = "noreply@giatky.site"
    OPENAI_API_KEY: str = ""
    IOT_DEVICE_SHARED_TOKEN: str = ""
    FRONTEND_ORIGINS: str = ""
    SECRET_KEY: str = Field(..., min_length=32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    EXPOSE_DEV_OTP: bool = False

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        """Xác thực rằng SECRET_KEY không phải là giá trị yếu hoặc mặc định."""
        if "heart_monitor" in value.lower() or value == "secret_key":
            raise ValueError("SECRET_KEY phải là giá trị mạnh và không được mặc định")
        return value

    @model_validator(mode="after")
    def validate_production_safety(self) -> "Settings":
        """Ngăn các cờ debug nhạy cảm được bật ở production."""
        normalized_environment = self.ENVIRONMENT.strip().lower()
        if normalized_environment in {"prod", "production"} and self.EXPOSE_DEV_OTP:
            raise ValueError("EXPOSE_DEV_OTP không được bật trong production")
        return self

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / "backend" / ".env"),
        extra="allow"
    )


# Thể hiện singleton Settings được dùng xuyên suốt ứng dụng
settings = Settings()
