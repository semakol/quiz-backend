from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from fastapi import HTTPException, status
from app.models import models
from app.schemas import schemas
from passlib.context import CryptContext
from app.utils.common import *
from app.core.config import settings

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

def create_quiz(db: Session, quiz_in: schemas.QuizCreate, current_user: Optional[models.User] = None) -> models.Quiz:
    quiz_data = quiz_in.dict()
    
    # Если пользователь авторизован, всегда используем его ID как author_id
    if current_user:
        quiz_data['author_id'] = current_user.id
    elif settings.REQUIRE_AUTH and not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    elif not current_user:
        # Если REQUIRE_AUTH выключен и пользователь не авторизован,
        # проверяем, что author_id существует в базе
        author_id = quiz_data.get('author_id')
        if author_id:
            author = get_user(db, author_id)
            if not author:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User with id {author_id} does not exist"
                )
    
    quiz = models.Quiz(**quiz_data)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

def get_quiz(db: Session, quiz_id: int) -> Optional[models.Quiz]:
    return db.get(models.Quiz, quiz_id)

def list_quizzes(db: Session, skip: int = 0, limit: int = 100) -> List[models.Quiz]:
    return db.query(models.Quiz).offset(skip).limit(limit).all()

def update_quiz(db: Session, quiz_id: int, quiz_in: schemas.QuizUpdate, current_user: Optional[models.User] = None) -> models.Quiz:
    quiz = get_quiz(db, quiz_id)
    if not quiz:
        return None
    if settings.REQUIRE_AUTH:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    update_data = quiz_in.dict(exclude_unset=True)
    for k, v in update_data.items():
        if not v is None:
            setattr(quiz, k, v)
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz

def delete_quiz(db: Session, quiz_id: int, current_user: Optional[models.User] = None) -> None:
    quiz = get_quiz(db, quiz_id)
    if not quiz:
        return None
    if settings.REQUIRE_AUTH:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    db.delete(quiz)
    db.commit()
    return None

def create_question_with_answers(db: Session, quiz_id: int, q_in: schemas.QuestionCreate, current_user: Optional[models.User] = None) -> models.Question:
    if settings.REQUIRE_AUTH:
        quiz = get_quiz(db, quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    q = models.Question(quiz_id=quiz_id, text=q_in.text, type=q_in.type, time_limit=q_in.time_limit, order_index=q_in.order_index, media_id=q_in.media_id, score=q_in.score)
    db.add(q)
    db.flush()
    for a in q_in.answers or []:
        ans = models.Answer(question_id=q.id, text=a.text, is_correct=a.is_correct)
        db.add(ans)
    db.commit()
    db.refresh(q)
    return q

def get_question(db: Session, question_id: int) -> Optional[models.Question]:
    return db.query(models.Question).options(joinedload(models.Question.media)).filter(models.Question.id == question_id).first()

def get_questions(db: Session, quiz_id: Optional[int] = None, skip: int = 0, limit: int = 100) -> List[models.Question]:
    query = db.query(models.Question).options(joinedload(models.Question.media))
    if quiz_id is not None:
        query = query.filter(models.Question.quiz_id == quiz_id)
    return query.order_by(models.Question.order_index).offset(skip).limit(limit).all()

def update_question(db: Session, question_id: int, q_in: schemas.QuestionUpdate, current_user: Optional[models.User] = None) -> Optional[models.Question]:
    q = get_question(db, question_id)
    if not q:
        return None
    if settings.REQUIRE_AUTH:
        quiz = get_quiz(db, q.quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    update_data = q_in.dict(exclude_unset=True)

    if q_in.answers is not None:
        db.query(models.Answer).filter(models.Answer.question_id == question_id).delete()
        for a in q_in.answers:
            ans = models.Answer(question_id=question_id, text=a.text, is_correct=a.is_correct)
            db.add(ans)

    for k, v in update_data.items():
        if k == 'answers':
            continue
        # Пропускаем только если значение явно None (не переданное поле)
        # Но разрешаем обновлять score=0, так как это валидное значение
        if v is None and k != 'score':
            continue
        setattr(q, k, v)
    db.add(q)
    db.commit()
    db.refresh(q)
    return q

def delete_question(db: Session, question_id: int, current_user: Optional[models.User] = None) -> None:
    q = get_question(db, question_id)
    if not q:
        return None
    if settings.REQUIRE_AUTH:
        quiz = get_quiz(db, q.quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    db.delete(q)
    db.commit()
    return None

def create_answer(db: Session, ans_in: schemas.AnswerCreate, current_user: Optional[models.User] = None) -> models.Answer:
    if settings.REQUIRE_AUTH:
        question = get_question(db, ans_in.question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        quiz = get_quiz(db, question.quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    ans = models.Answer(question_id=ans_in.question_id, text=ans_in.text, is_correct=ans_in.is_correct)
    db.add(ans)
    db.commit()
    db.refresh(ans)
    return ans

def get_answer(db: Session, answer_id: int) -> Optional[models.Answer]:
    return db.get(models.Answer, answer_id)

def update_answer(db: Session, answer_id: int, ans_in: schemas.AnswerUpdate, current_user: Optional[models.User] = None) -> Optional[models.Answer]:
    ans = get_answer(db, answer_id)
    if not ans:
        return None
    if settings.REQUIRE_AUTH:
        question = get_question(db, ans.question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        quiz = get_quiz(db, question.quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    update_data = ans_in.dict(exclude_unset=True)
    for k, v in update_data.items():
        setattr(ans, k, v)
    db.add(ans)
    db.commit()
    db.refresh(ans)
    return ans

def delete_answer(db: Session, answer_id: int, current_user: Optional[models.User] = None) -> None:
    ans = get_answer(db, answer_id)
    if not ans:
        return None
    if settings.REQUIRE_AUTH:
        question = get_question(db, ans.question_id)
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        quiz = get_quiz(db, question.quiz_id)
        if not quiz:
            raise HTTPException(status_code=404, detail="Quiz not found")
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )
        if quiz.author_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
    db.delete(ans)
    db.commit()
    return None

def create_media(db: Session, media_in: schemas.MediaCreate) -> models.Media:
    media = models.Media(**media_in.dict())
    db.add(media)
    db.commit()
    db.refresh(media)
    return media

def get_media(db: Session, media_id: int) -> Optional[models.Media]:
    return db.get(models.Media, media_id)

def create_session(db: Session, s_in: schemas.SessionCreate, current_user: models.User) -> models.SessionGame:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session_data = s_in.dict()
    session_data['host_id'] = current_user.id
    s = models.SessionGame(**session_data)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s

def list_sessions(db: Session, current_user: models.User, skip: int = 0, limit: int = 100) -> List[models.SessionGame]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    # Возвращаем только сессии, созданные текущим пользователем (host_id)
    return db.query(models.SessionGame).filter(
        models.SessionGame.host_id == current_user.id
    ).order_by(models.SessionGame.started_at.desc()).offset(skip).limit(limit).all()

def list_ended_sessions(db: Session, current_user: models.User, skip: int = 0, limit: int = 100) -> List[models.SessionGame]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    # Возвращаем только завершенные сессии, созданные текущим пользователем
    # Используем started_at для сортировки (ended_at может быть NULL)
    return db.query(models.SessionGame).filter(
        models.SessionGame.host_id == current_user.id,
        models.SessionGame.status == 'ended'
    ).order_by(models.SessionGame.started_at.desc()).offset(skip).limit(limit).all()

def get_session(db: Session, session_id: int, current_user: models.User) -> Optional[models.SessionGame]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session = db.get(models.SessionGame, session_id)
    if not session:
        return None
    return session

def update_session(db: Session, session_id: int, current_user: models.User) -> Optional[models.SessionGame]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session = db.get(models.SessionGame, session_id)
    if not session:
        return None
    if session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def delete_session(db: Session, session_id: int, current_user: models.User) -> None:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session = db.get(models.SessionGame, session_id)
    if not session:
        return None
    if session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    db.delete(session)
    db.commit()
    return None

def add_rule_to_session(db: Session, session_id: int, current_user: models.User) -> Optional[models.SessionGame]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session = db.get(models.SessionGame, session_id)
    if not session:
        return None
    if session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

def get_session_statistics(db: Session, session_id: int, current_user: models.User) -> Optional[dict]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session = db.get(models.SessionGame, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    if session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Получаем всех игроков сессии
    players = db.query(models.SessionPlayer).filter(
        models.SessionPlayer.session_id == session_id
    ).all()
    
    players_data = []
    for player in players:
        players_data.append({
            "id": player.id,
            "nickname": player.nickname or f"Игрок #{player.id}",
            "score": player.score or 0,
            "joined_at": player.joined_at
        })
    
    return {
        "session_id": session.id,
        "started_at": session.started_at,
        "ended_at": session.ended_at,
        "players": players_data
    }

def get_current_question(db: Session, session_id: int, current_user: models.User) -> Optional[models.Question]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session = db.get(models.SessionGame, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    if session.host_id != current_user.id:
        player = db.query(models.SessionPlayer).filter(
            models.SessionPlayer.session_id == session_id,
            models.SessionPlayer.user_id == current_user.id
        ).first()
        if not player:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a participant of this session"
            )
    
    if not session.current_question_id:
        return None
    
    question = db.get(models.Question, session.current_question_id)
    return question

def set_next_question(db: Session, session_id: int, current_user: models.User) -> Optional[models.Question]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    session = db.get(models.SessionGame, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    if session.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    questions = db.query(models.Question).filter(
        models.Question.quiz_id == session.quiz_id
    ).order_by(models.Question.order_index).all()
    
    if not questions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No questions found in this quiz"
        )
    
    if not session.current_question_id:
        next_question = questions[0]
    else:
        current_index = None
        for idx, q in enumerate(questions):
            if q.id == session.current_question_id:
                current_index = idx
                break
        
        if current_index is None:
            next_question = questions[0]
        elif current_index + 1 < len(questions):
            next_question = questions[current_index + 1]
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No more questions available"
            )
    
    session.current_question_id = next_question.id
    db.add(session)
    db.commit()
    db.refresh(session)
    
    return next_question
