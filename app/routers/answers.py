from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db

router = APIRouter(prefix="/answers", tags=["answers"])

@router.get('/{answer_id}')
def get_answer(answer_id: int, db: Session = Depends(get_db)):
    ans = crud.get_answer(db, answer_id)
    if not ans:
        raise HTTPException(404, 'Answer not found')
    return ans
