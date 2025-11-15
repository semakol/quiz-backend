from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db

router = APIRouter(prefix="/questions", tags=["questions"])

@router.post("/quiz/{quiz_id}", response_model=schemas.QuestionOut)
def create_question(quiz_id: int, q_in: schemas.QuestionCreate, db: Session = Depends(get_db)):
    q = crud.create_question_with_answers(db, quiz_id, q_in)
    return q
