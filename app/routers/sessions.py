from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post('/')
def create_session(s_in: schemas.SessionCreate, db: Session = Depends(get_db)):
    return crud.create_session(db, s_in)
