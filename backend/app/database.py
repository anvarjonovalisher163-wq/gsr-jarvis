"""SQLAlchemy engine and session factory. SQLite by default,
Postgres via DATABASE_URL (see README for the upgrade path)."""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings

settings = get_settings()

_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(settings.database_url, connect_args=_connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency yielding a request-scoped session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns(table: str, columns: dict[str, str]) -> None:
    """Minimal forward-only migration: add missing columns to an existing
    table. create_all() only creates new tables — it never alters existing
    ones — so every column added to a model after first deploy needs an
    entry in main.py's MIGRATIONS map. Works on both SQLite and Postgres."""
    insp = inspect(engine)
    if table not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns(table)}
    with engine.begin() as conn:
        for name, ddl in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
