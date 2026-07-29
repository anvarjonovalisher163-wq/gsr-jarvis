"""GSR Jarvis — FastAPI application entrypoint."""
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import Base, engine, ensure_columns
from .routers import (
    analytics,
    auth_router,
    chat,
    competitors,
    content,
    crm,
    dashboard,
    publish,
    push_router,
    seasons_router,
    strategy,
)
from .scheduler import shutdown_scheduler, start_scheduler

# Columns added to existing tables after first deploy (create_all cannot
# alter tables). Add one entry per new column; safe to run repeatedly.
MIGRATIONS: dict[str, dict[str, str]] = {
    "content_posts": {"body_ru": "TEXT NOT NULL DEFAULT ''"},
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    for table, columns in MIGRATIONS.items():
        ensure_columns(table, columns)
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="GSR Jarvis", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(crm.router, prefix="/api/crm", tags=["crm"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(content.router, prefix="/api/content", tags=["content"])
app.include_router(competitors.router, prefix="/api/competitors", tags=["competitors"])
app.include_router(strategy.router, prefix="/api/strategy", tags=["strategy"])
app.include_router(publish.router, prefix="/api/publish", tags=["publish"])
app.include_router(push_router.router, prefix="/api/push", tags=["push"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(seasons_router.router, prefix="/api/seasons", tags=["seasons"])

# AI-generated post images (see modules/imagegen.py). Created on demand so a
# fresh clone doesn't need the directory pre-created.
MEDIA_DIR = Path(__file__).resolve().parent.parent / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/api/health")
def health():
    return {"status": "ok"}
