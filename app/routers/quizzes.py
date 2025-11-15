from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

@router.post("/", response_model=schemas.QuizOut)
def create_quiz(quiz_in: schemas.QuizCreate, db: Session = Depends(get_db)):
    return crud.create_quiz(db, quiz_in)

@router.get("/{quiz_id}", response_model=schemas.QuizOut)
def get_quiz(quiz_id: int, db: Session = Depends(get_db)):
    q = crud.get_quiz(db, quiz_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return q

@router.get("/", response_model=List[schemas.QuizOut])
def list_quizzes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.list_quizzes(db, skip=skip, limit=limit)
