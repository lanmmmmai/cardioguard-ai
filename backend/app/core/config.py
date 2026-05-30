from pathlib import Path
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[3]
DEFAULT_SECRET_KEY = "heart_monitor_secret_key"
PRODUCTION_ENVIRONMENTS = {"prod", "production"}


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    DATABASE_URL: str
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str = ""
    BREVO_API_KEY: str = ""
    EMAIL_FROM_EMAIL: str = "noreply@cardioguard.ai"
    EMAIL_FROM_NAME: str = "CardioGuard AI"
    OPENAI_API_KEY: str = ""
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.ENVIRONMENT.lower() in PRODUCTION_ENVIRONMENTS:
            if not self.SECRET_KEY or self.SECRET_KEY == DEFAULT_SECRET_KEY:
                raise ValueError("SECRET_KEY must be set to a strong unique value in production")
        return self

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / "backend" / ".env"),
        extra="allow"
    )


settings = Settings()
