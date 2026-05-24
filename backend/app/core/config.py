from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    NEXT_PUBLIC_SUPABASE_URL: str = ""
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: str = ""

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()