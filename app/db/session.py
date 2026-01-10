from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import SQLAlchemyError, OperationalError
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

def create_database_engine():
    """Create PostgreSQL database engine"""
    logger.info(f"Инициализация подключения к БД. DATABASE_URL: {settings.DATABASE_URL[:50]}...")
    
    try:
        logger.info("Создание PostgreSQL engine...")
        engine = create_engine(settings.DATABASE_URL, future=True)
        # Попытка подключения для проверки
        logger.info("Проверка подключения к PostgreSQL...")
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✓ Подключение к PostgreSQL успешно")
        return engine
    except Exception as e:
        logger.error(f"✗ Ошибка подключения к PostgreSQL: {e}")
        logger.error(f"  DATABASE_URL: {settings.DATABASE_URL[:100]}...")
        raise

try:
    engine = create_database_engine()
except Exception as e:
    logger.error(f"Критическая ошибка: не удалось создать engine: {e}")
    raise

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
logger.info("✓ SessionLocal создан успешно")

def get_db():
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as e:
        logger.error(f"Ошибка SQLAlchemy в get_db: {e}")
        db.rollback()
        raise
    except Exception as e:
        logger.error(f"Неожиданная ошибка в get_db: {e}")
        db.rollback()
        raise
    finally:
        db.close()
