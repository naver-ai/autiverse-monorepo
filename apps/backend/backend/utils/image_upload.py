import os
import shutil
import uuid
from pathlib import Path
from fastapi import HTTPException, UploadFile

# 이미지 저장 디렉토리 설정
UPLOAD_DIR = Path("uploads/images")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def save_uploaded_image(file: UploadFile) -> str:
    """업로드된 이미지 파일을 저장하고 파일명을 반환합니다."""
    # 파일 확장자 검증
    if not file.filename or not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
        raise HTTPException(status_code=400, detail="지원하지 않는 이미지 파일 형식입니다.")
    
    # 고유한 파일명 생성
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = UPLOAD_DIR / unique_filename
    
    # 파일 저장
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return unique_filename 