from sqlalchemy.orm import Session
from typing import List, Optional
from app.models import models
from app.schemas import schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# USER
def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    hashed = pwd_context.hash(user_in.password)
    db_user = models.User(username=user_in.username, email=user_in.email, password_hash=hashed, role=user_in.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.get(models.User, user_id)

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()

# QUIZZES
def create_quiz(db: Session, quiz_in: schemas.QuizCreate) -> models.Quiz:
    quiz = models.Quiz(**quiz_in.dict())
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

def get_quiz(db: Session, quiz_id: int) -> Optional[models.Quiz]:
    return db.get(models.Quiz, quiz_id)

def list_quizzes(db: Session, skip: int = 0, limit: int = 100) -> List[models.Quiz]:
    return db.query(models.Quiz).offset(skip).limit(limit).all()

# QUESTIONS & ANSWERS
def create_question_with_answers(db: Session, quiz_id: int, q_in: schemas.QuestionCreate) -> models.Question:
    q = models.Question(quiz_id=quiz_id, text=q_in.text, type=q_in.type, time_limit=q_in.time_limit, order_index=q_in.order_index, media_id=q_in.media_id)
    db.add(q)
    db.flush()
    for a in q_in.answers or []:
        ans = models.Answer(question_id=q.id, text=a.text, is_correct=a.is_correct)
        db.add(ans)
    db.commit()
    db.refresh(q)
    return q

def get_answer(db: Session, answer_id: int) -> Optional[models.Answer]:
    return db.get(models.Answer, answer_id)

# SESSIONS
def create_session(db: Session, s_in: schemas.SessionCreate) -> models.SessionGame:
    s = models.SessionGame(**s_in.dict())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s
