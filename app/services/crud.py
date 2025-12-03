from sqlalchemy.orm import Session
from typing import List, Optional
from app.models import models
from app.schemas import schemas
from passlib.context import CryptContext
from app.utils.common import *

# USER
def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    hashed = hash_password(user_in.password)
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

def update_quiz(db: Session, quiz_id: int, quiz_in: schemas.QuizUpdate) -> models.Quiz:
    quiz = get_quiz(db, quiz_id)
    if not quiz:
        return None
    update_data = quiz_in.dict(exclude_unset=True)
    for k, v in update_data.items():
        if not v is None:
            setattr(quiz, k, v)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

def delete_quiz(db: Session, quiz_id: int) -> None:
    quiz = get_quiz(db, quiz_id)
    if not quiz:
        return None
    db.delete(quiz)
    db.commit()
    return None

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

def get_question(db: Session, question_id: int) -> Optional[models.Question]:
    return db.get(models.Question, question_id)

def update_question(db: Session, question_id: int, q_in: schemas.QuestionUpdate) -> Optional[models.Question]:
    q = get_question(db, question_id)
    if not q:
        return None
    update_data = q_in.dict(exclude_unset=True)
    # Do not handle answers diff here; only update question fields
    for k, v in update_data.items():
        if k == 'answers':
            continue
        if v is None:
            continue
        setattr(q, k, v)
    db.add(q)
    db.commit()
    db.refresh(q)
    return q

def delete_question(db: Session, question_id: int) -> None:
    q = get_question(db, question_id)
    if not q:
        return None
    db.delete(q)
    db.commit()
    return None

def create_answer(db: Session, ans_in: schemas.AnswerCreate) -> models.Answer:
    ans = models.Answer(question_id=ans_in.question_id, text=ans_in.text, is_correct=ans_in.is_correct)
    db.add(ans)
    db.commit()
    db.refresh(ans)
    return ans

def get_answer(db: Session, answer_id: int) -> Optional[models.Answer]:
    return db.get(models.Answer, answer_id)

def update_answer(db: Session, answer_id: int, ans_in: schemas.AnswerUpdate) -> Optional[models.Answer]:
    ans = get_answer(db, answer_id)
    if not ans:
        return None
    update_data = ans_in.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(ans, k, v)
    db.add(ans)
    db.commit()
    db.refresh(ans)
    return ans

def delete_answer(db: Session, answer_id: int) -> None:
    ans = get_answer(db, answer_id)
    if not ans:
        return None
    db.delete(ans)
    db.commit()
    return None

# SESSIONS
def create_session(db: Session, s_in: schemas.SessionCreate) -> models.SessionGame:
    s = models.SessionGame(**s_in.dict())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s
