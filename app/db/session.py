from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import os
from typing import Optional

def create_database_engine():
    """Create database engine based on configuration (PostgreSQL or YDB)"""
    # Check if using YDB (either via USE_YDB flag or yandex:// URL scheme)
    use_ydb = settings.USE_YDB or settings.DATABASE_URL.startswith("yandex://")
    
    if use_ydb:
        # YDB Serverless configuration
        try:
            import ydb
            from ydb import credentials
            
            # Determine endpoint and database path
            endpoint_for_driver = None
            database = None
            
            if settings.DATABASE_URL.startswith("yandex://"):
                # Parse yandex:// URL format: yandex://endpoint:port/database_path
                url_without_scheme = settings.DATABASE_URL.replace("yandex://", "")
                if "/" in url_without_scheme:
                    endpoint_part, database = url_without_scheme.split("/", 1)
                    database = "/" + database
                    endpoint_for_driver = f"grpcs://{endpoint_part}"
                else:
                    endpoint_part = url_without_scheme
                    endpoint_for_driver = f"grpcs://{endpoint_part}"
                    database = "/local"
            elif settings.YDB_ENDPOINT and settings.YDB_DATABASE:
                # Use separate settings
                endpoint_raw = settings.YDB_ENDPOINT
                database = settings.YDB_DATABASE
                # Ensure endpoint has protocol
                if not endpoint_raw.startswith(("grpc://", "grpcs://")):
                    endpoint_for_driver = f"grpcs://{endpoint_raw}"
                else:
                    endpoint_for_driver = endpoint_raw
            else:
                raise ValueError(
                    "YDB configuration is incomplete. "
                    "Set YDB_ENDPOINT and YDB_DATABASE, or use DATABASE_URL in format: yandex://endpoint:port/database_path"
                )
            
            # Ensure database path starts with /
            if not database.startswith("/"):
                database = "/" + database
            
            # Configure authentication
            ydb_credentials = None
            if settings.YDB_SERVICE_ACCOUNT_KEY_FILE and os.path.exists(settings.YDB_SERVICE_ACCOUNT_KEY_FILE):
                ydb_credentials = credentials.iam_service_account_key_file(settings.YDB_SERVICE_ACCOUNT_KEY_FILE)
            elif settings.YDB_TOKEN:
                ydb_credentials = credentials.iam_token_credentials(settings.YDB_TOKEN)
            elif os.getenv("YDB_SERVICE_ACCOUNT_KEY_FILE"):
                key_file = os.getenv("YDB_SERVICE_ACCOUNT_KEY_FILE")
                if os.path.exists(key_file):
                    ydb_credentials = credentials.iam_service_account_key_file(key_file)
            
            # If no explicit credentials, try metadata service (for Yandex Cloud VMs)
            if ydb_credentials is None:
                try:
                    ydb_credentials = credentials.iam_metadata_credentials()
                except Exception:
                    # Fallback to anonymous (not recommended for production)
                    ydb_credentials = credentials.anonymous_credentials()
            
            # Create YDB driver
            driver_config = ydb.DriverConfig(
                endpoint=endpoint_for_driver,
                database=database,
                credentials=ydb_credentials
            )
            driver = ydb.Driver(driver_config)
            driver.wait(timeout=5, fail_fast=True)
            
            # Build URL for ydb-sqlalchemy (format: yandex://endpoint_without_protocol/database_path)
            # Extract endpoint without protocol for SQLAlchemy URL
            endpoint_for_url = endpoint_for_driver.replace("grpcs://", "").replace("grpc://", "")
            ydb_url = f"yandex://{endpoint_for_url}{database}"
            
            # Create SQLAlchemy engine with YDB driver
            engine = create_engine(
                ydb_url,
                future=True,
                connect_args={"driver": driver}
            )
            return engine
        except ImportError:
            raise ImportError("ydb package is required for YDB support. Install it with: pip install ydb ydb-sqlalchemy")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize YDB connection: {str(e)}")
    else:
        # PostgreSQL configuration (default)
        return create_engine(settings.DATABASE_URL, future=True)

engine = create_database_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
