from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post('/')
def create_session(s_in: schemas.SessionCreate, db: Session = Depends(get_db)):
    return crud.create_session(db, s_in)


@router.get('/{session_id}')
def get_session(session_id: int, db: Session = Depends(get_db)):
    return crud.get_session(db, session_id)

@router.put('/{session_id}')
def update_session(session_id: int, db: Session = Depends(get_db)):
    return crud.update_session(db, session_id)

@router.delete('/{session_id}')
def delete_session(session_id: int, db: Session = Depends(get_db)):
    return crud.delete_session(db, session_id)

@router.post('/{session_id}/rules')
def add_rule_to_session(session_id: int, db: Session = Depends(get_db)):
    return crud.add_rule_to_session(db, session_id)