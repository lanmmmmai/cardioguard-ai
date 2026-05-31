from pathlib import Path
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[3]
DEFAULT_SECRET_KEY = "heart_monitor_secret_key"


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str = ""
    BREVO_API_KEY: str = ""
    EMAIL_FROM_EMAIL: str = "noreply@cardioguard.ai"
    EMAIL_FROM_NAME: str = "CardioGuard AI"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = ""
    SMTP_FROM_EMAIL: str = ""
    OPENAI_API_KEY: str = ""
    IOT_DEVICE_SHARED_TOKEN: str = ""
    SECRET_KEY: str = Field(..., min_length=32)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    EXPOSE_DEV_OTP: bool = False

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        if value == DEFAULT_SECRET_KEY:
            raise ValueError("SECRET_KEY must not use the default development value")
        return value

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / "backend" / ".env"),
        extra="allow"
    )


settings = Settings()
