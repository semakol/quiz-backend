from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///quizdb.db"
    SECRET_KEY: str = "CHANGE_ME_TO_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    APP_NAME: str = "Quiz API"

    class Config:
        env_file = ".env"

settings = Settings()
