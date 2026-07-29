"""Strategy advisor endpoints: reports, generation, on-demand questions."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_owner
from ..database import get_db
from ..models import StrategyReport
from ..modules import strategy_advisor
from ..schemas import AnswerOut, AskIn, StrategyReportOut

router = APIRouter(dependencies=[Depends(require_owner)])


@router.get("/reports", response_model=list[StrategyReportOut])
def reports(limit: int = 6, db: Session = Depends(get_db)):
    return db.scalars(select(StrategyReport).order_by(StrategyReport.id.desc()).limit(limit)).all()


@router.post("/generate", response_model=StrategyReportOut)
async def generate(db: Session = Depends(get_db)):
    return await strategy_advisor.run_monthly_strategy(db)


@router.post("/ask", response_model=AnswerOut)
async def ask(payload: AskIn, db: Session = Depends(get_db)):
    answer = await strategy_advisor.answer_question(db, payload.question)
    return AnswerOut(answer=answer)
