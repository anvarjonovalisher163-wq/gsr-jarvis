"""Chat with Jarvis: history + streaming replies.

Conversation memory: messages are stored in the DB; on each turn only the
last CHAT_HISTORY_WINDOW messages are sent to Claude (cost control).
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..claude_client import ask_stream
from ..config import get_settings
from ..database import SessionLocal, get_db
from ..models import ChatMessage
from ..schemas import ChatIn, ChatMessageOut

router = APIRouter(dependencies=[Depends(require_owner)])
settings = get_settings()


def _history_window(db: Session) -> list[dict]:
    rows = db.scalars(
        select(ChatMessage).order_by(ChatMessage.id.desc()).limit(settings.chat_history_window)
    ).all()
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


@router.get("/history", response_model=list[ChatMessageOut])
def history(limit: int = 100, db: Session = Depends(get_db)):
    rows = db.scalars(select(ChatMessage).order_by(ChatMessage.id.desc()).limit(limit)).all()
    return list(reversed(rows))


@router.post("/clear")
def clear(db: Session = Depends(get_db)):
    db.query(ChatMessage).delete()
    db.commit()
    return {"ok": True}


@router.post("/stream")
async def stream(payload: ChatIn, db: Session = Depends(get_db)):
    """Streams the assistant reply as plain text chunks."""
    db.add(ChatMessage(role="user", content=payload.message))
    db.commit()
    messages = _history_window(db)

    async def generate():
        parts: list[str] = []
        try:
            async for delta in ask_stream(messages):
                parts.append(delta)
                yield delta
        finally:
            # Persist the reply even if the client disconnects mid-stream.
            text = "".join(parts)
            if text:
                with SessionLocal() as db2:
                    db2.add(ChatMessage(role="assistant", content=text))
                    db2.commit()

    return StreamingResponse(
        generate(),
        media_type="text/plain; charset=utf-8",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )
