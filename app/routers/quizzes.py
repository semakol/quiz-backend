from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db
from app.core.security import get_current_user
from app.models import models

router = APIRouter(prefix="/quizzes", tags=["quizzes"])

@router.post("/", response_model=schemas.QuizOut)
def create_quiz(
    quiz_in: schemas.QuizCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    return crud.create_quiz(db, quiz_in, current_user)

@router.get("/{quiz_id}", response_model=schemas.QuizOut)
def get_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    q = crud.get_quiz(db, quiz_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return q

@router.get("/", response_model=List[schemas.QuizOut])
def list_quizzes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    return crud.list_quizzes(db, skip=skip, limit=limit)

@router.put("/{quiz_id}", response_model=schemas.QuizOut)
def update_quiz(
    quiz_id: int,
    quiz_in: schemas.QuizUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    q = crud.get_quiz(db, quiz_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return crud.update_quiz(db, quiz_id, quiz_in, current_user)

@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(
    quiz_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    q = crud.get_quiz(db, quiz_id)
    if not q:
        raise HTTPException(status_code=404, detail="Quiz not found")
    crud.delete_quiz(db, quiz_id, current_user)
    return
