from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, RedirectResponse
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
from app.utils.storage import (
    upload_file_to_storage,
    get_public_url,
    get_file_url,
    file_exists_in_storage
)
from app.core.config import settings

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

        content_type = file.content_type or "application/octet-stream"
        
        if settings.USE_OBJECT_STORAGE:
            file.file.seek(0)
            success = upload_file_to_storage(
                file.file,
                unique_filename,
                content_type=content_type
            )
            
            if not success:
                raise HTTPException(status_code=500, detail="Failed to upload file to storage")

            file_url = get_public_url(unique_filename)
            uri = file_url
        else:
            file_path = MEDIA_DIR / unique_filename
            file.file.seek(0)
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            uri = f"/media/{unique_filename}"
        
        media_in = schemas.MediaCreate(
            title=file.filename,
            uri=uri
        )
        media = crud.create_media(db, media_in)
        
        return media
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")

@router.get("/files/{filename}")
async def get_file(
    filename: str,
    db: Session = Depends(get_db)
):
    if settings.USE_OBJECT_STORAGE:
        if not file_exists_in_storage(filename):
            raise HTTPException(status_code=404, detail="File not found")

        public_url = get_public_url(filename)
        return RedirectResponse(url=public_url, status_code=302)
    else:
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


