from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    DATABASE_URL: str
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str = ""
    BREVO_API_KEY: str = ""
    EMAIL_FROM_EMAIL: str = "noreply@cardioguard.ai"
    EMAIL_FROM_NAME: str = "CardioGuard AI"
    OPENAI_API_KEY: str = ""
    SECRET_KEY: str = "heart_monitor_secret_key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", BASE_DIR / "backend" / ".env"),
        extra="allow"
    )


settings = Settings()
