from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from app.routers import auth, users, quizzes, questions, answers, sessions, websocket
from app.db.session import engine
from app.db.init_db import init_db

app = FastAPI(title="Quiz API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins like ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = '/api'

app.include_router(auth.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(quizzes.router, prefix=prefix)
app.include_router(questions.router, prefix=prefix)
app.include_router(answers.router, prefix=prefix)
app.include_router(sessions.router, prefix=prefix)
app.include_router(websocket.router, prefix=prefix)

# create tables (for development; use Alembic for production)
try:
    init_db(engine)
except Exception:
    pass

@app.get('/api')
def root():
    return {"hello": "quiz api"}
