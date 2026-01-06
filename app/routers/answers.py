from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db
from app.core.security import get_current_user
from app.models import models

router = APIRouter(prefix="/answers", tags=["answers"])

@router.get("/{answer_id}", response_model=schemas.AnswerOut)
def get_answer(
    answer_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    ans = crud.get_answer(db, answer_id)
    if not ans:
        raise HTTPException(status_code=404, detail="Answer not found")
    return ans

@router.post("/", response_model=schemas.AnswerOut)
def create_answer(
    ans_in: schemas.AnswerCreate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    return crud.create_answer(db, ans_in, current_user)

@router.put("/{answer_id}", response_model=schemas.AnswerOut)
def update_answer(
    answer_id: int,
    ans_in: schemas.AnswerUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    ans = crud.get_answer(db, answer_id)
    if not ans:
        raise HTTPException(status_code=404, detail="Answer not found")
    return crud.update_answer(db, answer_id, ans_in, current_user)

@router.delete("/{answer_id}", status_code=204)
def delete_answer(
    answer_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    ans = crud.get_answer(db, answer_id)
    if not ans:
        raise HTTPException(status_code=404, detail="Answer not found")
    crud.delete_answer(db, answer_id, current_user)
    return
