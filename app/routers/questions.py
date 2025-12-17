from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db

router = APIRouter(prefix="/questions", tags=["questions"])

@router.get("/", response_model=List[schemas.QuestionOut])
def get_questions(quiz_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_questions(db, quiz_id=quiz_id, skip=skip, limit=limit)

@router.get("/{question_id}", response_model=schemas.QuestionOut)
def get_question(question_id: int, db: Session = Depends(get_db)):
    q = crud.get_question(db, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q

@router.post("/quiz/{quiz_id}", response_model=schemas.QuestionOut)
def create_question(quiz_id: int, q_in: schemas.QuestionCreate, db: Session = Depends(get_db)):
    q = crud.create_question_with_answers(db, quiz_id, q_in)
    return q

@router.put("/{question_id}", response_model=schemas.QuestionOut)
def update_question(question_id: int, q_in: schemas.QuestionUpdate, db: Session = Depends(get_db)):
    q = crud.get_question(db, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return crud.update_question(db, question_id, q_in)

@router.delete("/{question_id}", status_code=204)
def delete_question(question_id: int, db: Session = Depends(get_db)):
    q = crud.get_question(db, question_id)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    crud.delete_question(db, question_id)
    return
