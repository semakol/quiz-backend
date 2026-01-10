from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from sqlalchemy import text
import logging

from app.routers import auth, users, quizzes, questions, answers, sessions, websocket, media
from app.db.session import engine
from app.db.init_db import init_db
from app.core.config import settings

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Quiz API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = '/api'

app.include_router(auth.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(quizzes.router, prefix=prefix)
app.include_router(questions.router, prefix=prefix)
app.include_router(answers.router, prefix=prefix)
app.include_router(sessions.router, prefix=prefix)
app.include_router(websocket.router, prefix=prefix)
app.include_router(media.router, prefix=prefix)

@app.on_event("startup")
async def startup_event():
    logger.info("=" * 50)
    logger.info("Запуск приложения Quiz API")
    logger.info("=" * 50)
    logger.info(f"APP_NAME: {settings.APP_NAME}")
    logger.info(f"DATABASE_URL: {settings.DATABASE_URL[:50]}...")
    logger.info(f"SECRET_KEY установлен: {settings.SECRET_KEY != 'CHANGE_ME_TO_SECRET'}")
    logger.info(f"USE_OBJECT_STORAGE: {settings.USE_OBJECT_STORAGE}")
    logger.info(f"USE_INMEMORY_REDIS: {settings.USE_INMEMORY_REDIS}")
    logger.info("=" * 50)

# create tables (for development; use Alembic for production)
try:
    logger.info("Инициализация базы данных...")
    init_db(engine)
    logger.info("✓ База данных инициализирована")
except Exception as e:
    logger.warning(f"Предупреждение при инициализации БД: {e}")
    logger.info("Продолжаем работу (возможно, миграции уже применены)")

@app.get('/api')
def root():
    return {"hello": "quiz api"}

@app.get('/api/health')
def health_check():
    """Проверка состояния приложения и подключения к БД"""
    db_status = "unknown"
    try:
        from app.db.session import engine
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:100]}"
    
    return {
        "status": "ok",
        "database": db_status,
        "app_name": settings.APP_NAME,
        "env_loaded": settings.SECRET_KEY != "CHANGE_ME_TO_SECRET"
    }
