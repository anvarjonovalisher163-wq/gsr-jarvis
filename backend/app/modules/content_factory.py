"""Module A — Content Factory.

Generates a weekly Instagram content plan (5 posts) with full bilingual copy
(Uzbek + Russian, hook + value + CTA), hashtags and best posting time.
Active seasonal signals (Chinese holidays, shopping festivals) are injected
into the prompt so the plan reacts to freight-demand windows. Drafts land in
the DB with status "review" and wait for the owner's explicit approval.
"""
import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from ..claude_client import ask_json
from ..config import get_settings
from ..models import ContentPost, PostStatus
from . import seasons

log = logging.getLogger(__name__)
settings = get_settings()

PILLARS = [
    "xizmat tushuntirish (avia vs temir yo'l vs avto)",
    "rasstamojka / bojxona FAQ",
    "mijoz keysi",
    "narx / tarif yangiliklari",
    "Juma tabrigi",
    "aksiya / promo",
]

# Structured-output schema for the weekly plan. Exactly 5 items is enforced
# in the prompt (array count constraints are not supported by the API).
PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "posts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "post_type": {"type": "string", "enum": ["post", "carousel", "reels"]},
                    "pillar": {"type": "string"},
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "body_ru": {"type": "string"},
                    "hashtags": {"type": "string"},
                    "best_time": {"type": "string"},
                },
                "required": [
                    "post_type",
                    "pillar",
                    "title",
                    "body",
                    "body_ru",
                    "hashtags",
                    "best_time",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["posts"],
    "additionalProperties": False,
}


def current_week_start(today: date | None = None) -> date:
    today = today or date.today()
    return today - timedelta(days=today.weekday())


def _build_prompt(week_start: date) -> str:
    week_end = week_start + timedelta(days=6)
    pillars = "; ".join(PILLARS)
    return (
        f"{week_start.isoformat()} — {week_end.isoformat()} haftasi uchun Instagram "
        "kontent-plan tuz.\n\n"
        "TALABLAR:\n"
        "- Roppa-rosa 5 ta post bo'lsin, formatlar aralash: kamida 1 ta carousel va "
        "1 ta reels g'oyasi.\n"
        "- Har bir post uchun maydonlar:\n"
        "  * post_type: \"post\" | \"carousel\" | \"reels\"\n"
        f"  * pillar: quyidagi ustunlardan biri: {pillars}\n"
        "  * title: qisqa ichki sarlavha (planda ko'rinadi)\n"
        "  * body: to'liq tayyor matn HOOK + QIYMAT + CTA tuzilishida, o'zbek (lotin) "
        "tilida. Carousel bo'lsa slaydlar bo'yicha (\"1-slayd:\", \"2-slayd:\" ...), "
        "reels bo'lsa qisqa ssenariy (kadr + overlay matn + ovoz).\n"
        "  * body_ru: xuddi shu postning RUSCHA versiyasi — so'zma-so'z tarjima emas, "
        "rus tilida o'qiydigan auditoriyaga tabiiy yozilgan, tuzilishi bir xil.\n"
        "  * hashtags: 8-12 ta hashtag, probel bilan ajratilgan\n"
        "  * best_time: joylash uchun eng yaxshi kun va soat (masalan: \"Seshanba 19:00\")\n"
        "- Bitta post albatta Juma tabrigi bo'lsin va juma kuniga rejalashtirilsin.\n"
        "- Matnlar sotuvga yo'naltirilgan, aniq raqamlar va amaliy foyda bilan bo'lsin."
        + seasons.prompt_lines(week_start)
    )


async def generate_weekly_plan(db: Session, week_start: date | None = None) -> list[ContentPost]:
    """Generate and persist a 5-post weekly plan. Returns created posts."""
    week_start = week_start or current_week_start()
    data = await ask_json(
        [{"role": "user", "content": _build_prompt(week_start)}],
        PLAN_SCHEMA,
        max_tokens=settings.claude_plan_max_tokens,
    )

    created: list[ContentPost] = []
    for item in data.get("posts", [])[:7]:
        post = ContentPost(
            week_start=week_start,
            pillar=item.get("pillar", ""),
            post_type=item.get("post_type", "post"),
            title=item.get("title", ""),
            body=item.get("body", ""),
            body_ru=item.get("body_ru", ""),
            hashtags=item.get("hashtags", ""),
            best_time=item.get("best_time", ""),
            status=PostStatus.REVIEW,
        )
        db.add(post)
        created.append(post)
    db.commit()
    log.info("Weekly plan generated: %d posts for week %s", len(created), week_start)
    return created
