from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas import schemas
from app.services import crud
from app.db.session import get_db
from app.core.security import create_access_token
from app.core.config import settings
from app.db.redis import cache_user_check, get_cached_user_check, cache_token
from fastapi.security import OAuth2PasswordRequestForm
from app.utils.common import check_password

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post('/signup', response_model=schemas.UserOut)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    cached_result = get_cached_user_check(user_in.email)
    if cached_result is True:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing = crud.get_user_by_email(db, user_in.email)
    if existing:
        cache_user_check(user_in.email, True)
        raise HTTPException(status_code=400, detail="Email already registered")
    
    cache_user_check(user_in.email, False)
    
    user = crud.create_user(db, user_in)
    
    cache_user_check(user_in.email, True)
    
    return user

@router.post('/token', response_model=schemas.Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect credentials")
    
    if not check_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect credentials")
    
    access_token = create_access_token(subject=str(user.id))
    
    cache_token(
        str(user.id), 
        access_token, 
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return schemas.Token(access_token=access_token)
