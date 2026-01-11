from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    quizzes = relationship("Quiz", back_populates="author")

class Quiz(Base):
    __tablename__ = "quizzes"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_public = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)

    author = relationship("User", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")

class Media(Base):
    __tablename__ = "media"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    uri = Column(String(255), nullable=False)

class Question(Base):
    __tablename__ = "questions"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    text = Column(Text, nullable=True)
    type = Column(String(255), nullable=False)
    time_limit = Column(Integer, nullable=True)
    order_index = Column(Integer, nullable=False)
    media_id = Column(Integer, ForeignKey("media.id"), nullable=True)
    score = Column(Integer, nullable=True)

    quiz = relationship("Quiz", back_populates="questions")
    answers = relationship("Answer", back_populates="question", cascade="all, delete-orphan")
    media = relationship("Media")

class Answer(Base):
    __tablename__ = "answers"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)

    question = relationship("Question", back_populates="answers")

class SessionGame(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    url = Column(String(255), nullable=False, unique=True)
    started_at = Column(TIMESTAMP, default=datetime.utcnow)
    ended_at = Column(TIMESTAMP, nullable=True)
    status = Column(String(50), nullable=False)
    current_question_id = Column(Integer, ForeignKey("questions.id"), nullable=True)

class SessionPlayer(Base):
    __tablename__ = "sessions_players"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    nickname = Column(String(255), nullable=True)
    score = Column(Integer, nullable=True)
    joined_at = Column(TIMESTAMP, default=datetime.utcnow)

class PlayerAnswer(Base):
    __tablename__ = "player_answers"
    id = Column(Integer, primary_key=True, index=True)
    session_player_id = Column(Integer, ForeignKey("sessions_players.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    answer_id = Column(Integer, ForeignKey("answers.id"), nullable=True)
    text_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    answered_at = Column(TIMESTAMP, default=datetime.utcnow)
