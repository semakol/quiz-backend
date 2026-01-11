from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db
from app.core.security import get_current_user_required
from app.models import models
from app.routers.websocket import manager

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post('/')
def create_session(
    s_in: schemas.SessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    return crud.create_session(db, s_in, current_user)

@router.get('/', response_model=List[schemas.SessionOut])
def list_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    return crud.list_sessions(db, current_user, skip=skip, limit=limit)

@router.get('/ended', response_model=List[schemas.SessionOut])
def list_ended_sessions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    return crud.list_ended_sessions(db, current_user, skip=skip, limit=limit)

@router.get('/{session_id}')
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    return crud.get_session(db, session_id, current_user)

@router.put('/{session_id}')
def update_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    return crud.update_session(db, session_id, current_user)

@router.delete('/{session_id}')
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    return crud.delete_session(db, session_id, current_user)

@router.post('/{session_id}/rules')
def add_rule_to_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    return crud.add_rule_to_session(db, session_id, current_user)

@router.get('/{session_id}/statistics', response_model=schemas.SessionStatistics)
def get_session_statistics(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    statistics = crud.get_session_statistics(db, session_id, current_user)
    if not statistics:
        raise HTTPException(status_code=404, detail="Session statistics not found")
    return statistics

@router.get('/{session_id}/current-question', response_model=schemas.QuestionOut)
def get_current_question(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    question = crud.get_current_question(db, session_id, current_user)
    if not question:
        raise HTTPException(status_code=404, detail="No current question in this session")
    return question

@router.post('/{session_id}/questions/next', response_model=schemas.QuestionOut)
async def next_question(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user_required)
):
    question = crud.set_next_question(db, session_id, current_user)
    
    session = crud.get_session(db, session_id, current_user)
    if session:
        await manager.broadcast(
            session.url,
            {
                "type": "question_available",
                "question_id": question.id,
                "session_id": session_id
            }
        )
    
    return question