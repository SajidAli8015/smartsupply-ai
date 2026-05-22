from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings
from db.base import Base  # noqa: F401 — re-exported so callers can do `from db.session import Base`

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """FastAPI dependency — yields a database session and closes it on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
