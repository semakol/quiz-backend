from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///quizdb.db"
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

    class Config:
        env_file = ".env"

settings = Settings()
