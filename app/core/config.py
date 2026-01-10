from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/quizdb"
    SECRET_KEY: str = "CHANGE_ME_TO_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    APP_NAME: str = "Quiz API"
    REDIS_URL: str =  "" #"redis://localhost:6379/0"
    USE_INMEMORY_REDIS: bool = True
    REDIS_SIGNUP_RATE_LIMIT: int = 5
    REDIS_SIGNUP_RATE_WINDOW: int = 3600
    REDIS_LOGIN_RATE_LIMIT: int = 10
    REDIS_LOGIN_RATE_WINDOW: int = 900
    REQUIRE_AUTH: bool = True

    USE_OBJECT_STORAGE: bool = False
    YANDEX_STORAGE_BUCKET: str = ""
    YANDEX_STORAGE_ACCESS_KEY: str = ""
    YANDEX_STORAGE_SECRET_KEY: str = ""
    YANDEX_STORAGE_ENDPOINT: str = "https://storage.yandexcloud.net"
    YANDEX_STORAGE_REGION: str = "ru-central1"

    class Config:
        env_file = ".env"

settings = Settings()
