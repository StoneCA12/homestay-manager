from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours — one work shift
    COOKIE_SECURE: bool = False  # Set True in production (requires HTTPS)
    CORS_ORIGINS: list[str] = ["http://localhost:8080", "http://localhost:5173"]
    LOGIN_RATE_LIMIT: str = "5/minute"

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_strength(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        weak_patterns = ("dev-", "secret", "change", "example", "test")
        if any(p in v.lower() for p in weak_patterns):
            raise ValueError("SECRET_KEY looks like a placeholder — set a real random secret")
        return v

    class Config:
        env_file = ".env"


settings = Settings()
