from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DEBUG: bool = True
    SQLALCHEMY_DATABASE_URL: str = "sqlite:///./sqlite.db"
    JWT_SECRET_KEY: str = "test"


settings = Settings()