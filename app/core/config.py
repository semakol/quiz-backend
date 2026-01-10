from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database configuration
    # PostgreSQL connection string: postgresql+psycopg2://user:password@host:port/database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/quizdb"
    
    # Application settings
    SECRET_KEY: str = "CHANGE_ME_TO_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    APP_NAME: str = "Quiz API"
    
    # Redis configuration
    REDIS_URL: str = ""  # "redis://localhost:6379/0"
    USE_INMEMORY_REDIS: bool = True
    REDIS_SIGNUP_RATE_LIMIT: int = 5
    REDIS_SIGNUP_RATE_WINDOW: int = 3600
    REDIS_LOGIN_RATE_LIMIT: int = 10
    REDIS_LOGIN_RATE_WINDOW: int = 900
    REQUIRE_AUTH: bool = True

    # Yandex Object Storage
    USE_OBJECT_STORAGE: bool = False
    YANDEX_STORAGE_BUCKET: str = ""
    YANDEX_STORAGE_ACCESS_KEY: str = ""
    YANDEX_STORAGE_SECRET_KEY: str = ""
    YANDEX_STORAGE_ENDPOINT: str = "https://storage.yandexcloud.net"
    YANDEX_STORAGE_REGION: str = "ru-central1"

    class Config:
        env_file = ".env"

settings = Settings()
