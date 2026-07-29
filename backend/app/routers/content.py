"""Content plan endpoints: list, generate, edit, approve/reject, image."""
import json
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..database import get_db
from ..models import ContentPost, PostStatus, utcnow
from ..modules import content_factory
from ..modules.imagegen import SIZE_SQUARE, get_provider
from ..schemas import GenerateIn, PostOut, PostPatch

router = APIRouter(dependencies=[Depends(require_owner)])


def _get_post(db: Session, post_id: int) -> ContentPost:
    post = db.get(ContentPost, post_id)
    if post is None:
        raise HTTPException(404, detail="Post topilmadi")
    return post


@router.get("/plan", response_model=list[PostOut])
def plan(db: Session = Depends(get_db)):
    """Posts for the last 5 weeks, newest week first."""
    since = date.today() - timedelta(days=35)
    rows = db.scalars(
        select(ContentPost)
        .where(ContentPost.week_start >= since)
        .order_by(ContentPost.week_start.desc(), ContentPost.id.asc())
    ).all()
    return rows


@router.post("/generate", response_model=list[PostOut])
async def generate(payload: GenerateIn, db: Session = Depends(get_db)):
    posts = await content_factory.generate_weekly_plan(db, payload.week_start)
    return posts


@router.patch("/{post_id}", response_model=PostOut)
def update(post_id: int, payload: PostPatch, db: Session = Depends(get_db)):
    post = _get_post(db, post_id)
    if post.status == PostStatus.PUBLISHED:
        raise HTTPException(400, detail="Joylangan postni tahrirlab bo'lmaydi")
    if payload.title is not None:
        post.title = payload.title
    if payload.body is not None:
        post.body = payload.body
    if payload.body_ru is not None:
        post.body_ru = payload.body_ru
    if payload.hashtags is not None:
        post.hashtags = payload.hashtags
    if payload.best_time is not None:
        post.best_time = payload.best_time
    if payload.image_urls is not None:
        post.image_urls = json.dumps(payload.image_urls)
    # Any edit sends the post back to review — the owner re-approves the
    # exact text that will be published.
    if post.status == PostStatus.APPROVED:
        post.status = PostStatus.REVIEW
        post.approved_at = None
    db.commit()
    return post


@router.post("/{post_id}/approve", response_model=PostOut)
def approve(post_id: int, db: Session = Depends(get_db)):
    post = _get_post(db, post_id)
    if post.status == PostStatus.PUBLISHED:
        raise HTTPException(400, detail="Post allaqachon joylangan")
    post.status = PostStatus.APPROVED
    post.approved_at = utcnow()
    db.commit()
    return post


@router.post("/{post_id}/reject", response_model=PostOut)
def reject(post_id: int, db: Session = Depends(get_db)):
    post = _get_post(db, post_id)
    if post.status == PostStatus.PUBLISHED:
        raise HTTPException(400, detail="Post allaqachon joylangan")
    post.status = PostStatus.REJECTED
    post.approved_at = None
    db.commit()
    return post


@router.post("/{post_id}/generate-image", response_model=PostOut)
async def generate_image(post_id: int, db: Session = Depends(get_db)):
    """Generate an image via the configured provider and attach it."""
    post = _get_post(db, post_id)
    provider = get_provider()
    prompt = (
        f"Instagram marketing image for a China-Uzbekistan logistics company. "
        f"Post topic: {post.title}. Clean, professional, freight/cargo theme."
    )
    url = await provider.generate(prompt, SIZE_SQUARE)
    if url is None:
        raise HTTPException(
            501,
            detail="Rasm generatsiyasi sozlanmagan (IMAGE_PROVIDER=stub). "
            "Rasm URL'ni qo'lda biriktirishingiz mumkin.",
        )
    images = json.loads(post.image_urls or "[]")
    images.append(url)
    post.image_urls = json.dumps(images)
    db.commit()
    return post
