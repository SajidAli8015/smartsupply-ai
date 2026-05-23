from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    # Look for .env in the backend dir first, then fall back to the project root.
    # This lets `cd backend && uvicorn main:app --reload` find the root-level .env
    # while still allowing a backend-local override.
    model_config = SettingsConfigDict(
        env_file=["../.env", ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
    )

    PROJECT_NAME: str = "SmartSupply AI"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    DATABASE_URL: str = "postgresql://smartsupply:smartsupply123@localhost:5432/smartsupply_db"
    SECRET_KEY: str = "changeme"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Redis is optional — background tasks are disabled when not set.
    REDIS_URL: Optional[str] = None

    GEMINI_API_KEY: str = ""

    STRIPE_SECRET_KEY: str = ""
    SENDGRID_API_KEY: str = ""

    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_S3_BUCKET: str = ""

    @property
    def redis_enabled(self) -> bool:
        return self.REDIS_URL is not None


settings = Settings()
