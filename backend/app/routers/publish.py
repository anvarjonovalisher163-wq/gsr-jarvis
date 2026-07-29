"""Publishing endpoint — the ONLY call site of modules/publisher.py.

Sits behind owner JWT auth (`require_owner`). Combined with the guard inside
`publisher.publish_post()` (approved-only), this makes auto-publishing
architecturally impossible: no scheduler job or other code path can reach
the Meta Graph API.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..database import get_db
from ..models import ContentPost, PostStatus, utcnow
from ..modules.publisher import PublishError, publish_post
from ..schemas import PostOut

router = APIRouter(dependencies=[Depends(require_owner)])


@router.post("/{post_id}", response_model=PostOut)
async def publish(post_id: int, db: Session = Depends(get_db)):
    post = db.get(ContentPost, post_id)
    if post is None:
        raise HTTPException(404, detail="Post topilmadi")
    if post.status == PostStatus.PUBLISHED:
        raise HTTPException(400, detail="Post allaqachon joylangan")

    try:
        media_id = await publish_post(post)
    except PublishError as e:
        raise HTTPException(400, detail=str(e))

    post.status = PostStatus.PUBLISHED
    post.published_at = utcnow()
    post.ig_media_id = media_id
    db.commit()
    return post
