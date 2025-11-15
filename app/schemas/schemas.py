from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

# users
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "user"

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: str
    created_at: datetime

    class Config:
        model_config = {"from_attributes": True}

# auth
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str

# quizzes
class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    author_id: int
    is_public: bool = False

class QuizOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    author_id: int
    is_public: bool
    created_at: datetime

    class Config:
        model_config = {"from_attributes": True}

# questions & answers
class AnswerCreate(BaseModel):
    text: str
    is_correct: bool = False

class AnswerOut(BaseModel):
    id: int
    text: str
    is_correct: bool
    class Config:
        model_config = {"from_attributes": True}

class QuestionCreate(BaseModel):
    text: Optional[str]
    type: str
    time_limit: Optional[int]
    order_index: int
    media_id: Optional[int]
    answers: Optional[List[AnswerCreate]] = []

class QuestionOut(BaseModel):
    id: int
    text: Optional[str]
    type: str
    time_limit: Optional[int]
    order_index: int
    media_id: Optional[int]
    answers: List[AnswerOut] = []
    class Config:
        model_config = {"from_attributes": True}

# sessions
class SessionCreate(BaseModel):
    quiz_id: int
    host_id: int
    url: str
    status: str

class SessionPlayerCreate(BaseModel):
    session_id: int
    user_id: Optional[int]
    nickname: Optional[str]

class PlayerAnswerCreate(BaseModel):
    session_player_id: int
    question_id: int
    answer_id: Optional[int]
    text_answer: Optional[str]
    is_correct: Optional[bool]
