from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db
from app.core.security import get_current_user
from app.models import models

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/{user_id}", response_model=schemas.UserOut)
def read_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
