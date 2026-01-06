from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import shutil
import uuid
from pathlib import Path
from app.db.session import get_db
from app.schemas import schemas
from app.services import crud
from app.core.security import get_current_user
from app.models import models

router = APIRouter(prefix="/media", tags=["media"])

MEDIA_DIR = Path("media")
MEDIA_DIR.mkdir(exist_ok=True)

@router.post("/upload", response_model=schemas.MediaOut)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    try:
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = MEDIA_DIR / unique_filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        media_in = schemas.MediaCreate(
            title=file.filename,
            uri=f"/media/files/{unique_filename}"
        )
        media = crud.create_media(db, media_in)
        
        return media
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@router.get("/files/{filename}")
async def get_file(
    filename: str,
    db: Session = Depends(get_db)
):
    file_path = MEDIA_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type='application/octet-stream'
    )

@router.get("/{media_id}", response_model=schemas.MediaOut)
async def get_media(
    media_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_current_user)
):
    media = crud.get_media(db, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    return media


