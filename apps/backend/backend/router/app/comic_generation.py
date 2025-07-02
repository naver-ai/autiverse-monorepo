from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
import asyncio
import threading
import time
from sqlalchemy.orm import Session
from ...database.engine import get_session
from ...database.crud.chatbot import get_journal, update_comic_data
from ...utils.comic_grid_generator import ComicGridGenerator

router = APIRouter()

# 전역 변수로 생성 상태 추적
comic_generation_status = {}

class ComicGenerationRequest(BaseModel):
    journal_entry_id: str
    panel_contents: Dict[str, str]
    is_first_generation: bool = False

class ComicGenerationResponse(BaseModel):
    status: str
    progress: int
    message: str
    comic_data: Optional[Dict[str, Any]] = None

def generate_comic_with_progress(journal_entry_id: str, panel_contents: Dict[str, str], is_first_generation: bool = False):
    """백그라운드에서 만화를 생성하고 진행률을 업데이트"""
    try:
        # 초기 상태 설정
        comic_generation_status[journal_entry_id] = {
            "status": "generating",
            "progress": 0,
            "message": "스토리 분석 중...",
            "comic_data": None
        }
        
        # 1단계: 스토리 분석 (20%)
        comic_generation_status[journal_entry_id]["progress"] = 20
        comic_generation_status[journal_entry_id]["message"] = "어떻게 그릴지 고민중이다~"
        
        # 2단계: 패널 구조 분석 (40%)
        comic_generation_status[journal_entry_id]["progress"] = 40
        comic_generation_status[journal_entry_id]["message"] = "어떻게 그릴지 고민중이다~"
        
        # 3단계: 그리드 레이아웃 생성 (60%)
        comic_generation_status[journal_entry_id]["progress"] = 60
        comic_generation_status[journal_entry_id]["message"] = "오케이! 이렇게 그려보겠어!"
        
        # 4단계: 위치 관계 결정 (80%)
        comic_generation_status[journal_entry_id]["progress"] = 80
        comic_generation_status[journal_entry_id]["message"] = "오케이! 이렇게 그려보겠어!"
        
        # 5단계: 실제 만화 생성
        def progress_callback(progress: int, message: str):
            comic_generation_status[journal_entry_id]["progress"] = progress
            comic_generation_status[journal_entry_id]["message"] = message
        
        generator = ComicGridGenerator()
        comic_data = generator.generate_comic_grids(panel_contents, progress_callback)
        
        print(f"[DEBUG] Comic generation completed for {journal_entry_id}")
        print(f"[DEBUG] Comic data: {comic_data}")
        
        # 완료 상태 설정
        comic_generation_status[journal_entry_id] = {
            "status": "completed",
            "progress": 100,
            "message": "만화 생성 완료!",
            "comic_data": comic_data
        }
        
        print(f"[DEBUG] Status updated to completed for {journal_entry_id}")
        
        # 데이터베이스에 저장
        from ...database.engine import get_session
        db = next(get_session())
        
        if is_first_generation:
            # 첫 번째 만화 생성: first_panel에 저장
            update_comic_data(
                db, journal_entry_id,
                first_panel1=comic_data.get("panel1"),
                first_panel2=comic_data.get("panel2"),
                first_panel3=comic_data.get("panel3"),
                first_panel4=comic_data.get("panel4")
            )
        else:
            # 두 번째 만화 생성: second_panel에 저장
            update_comic_data(
                db, journal_entry_id,
                second_panel1=comic_data.get("panel1"),
                second_panel2=comic_data.get("panel2"),
                second_panel3=comic_data.get("panel3"),
                second_panel4=comic_data.get("panel4")
            )
        

        
    except Exception as e:
        # 에러 상태 설정
        comic_generation_status[journal_entry_id] = {
            "status": "error",
            "progress": 0,
            "message": f"만화 생성 중 오류가 발생했습니다: {str(e)}",
            "comic_data": None
        }

@router.post("/start", response_model=ComicGenerationResponse)
async def start_comic_generation(
    request: ComicGenerationRequest,
    background_tasks: BackgroundTasks
):
    """만화 생성 시작"""
    journal_entry_id = request.journal_entry_id
    
    # 이미 생성 중인지 확인
    if journal_entry_id in comic_generation_status:
        current_status = comic_generation_status[journal_entry_id]
        if current_status["status"] == "generating":
            return ComicGenerationResponse(**current_status)
    
    # 백그라운드에서 만화 생성 시작
    background_tasks.add_task(
        generate_comic_with_progress,
        journal_entry_id,
        request.panel_contents,
        request.is_first_generation
    )
    
    return ComicGenerationResponse(
        status="started",
        progress=0,
        message="만화 생성이 시작되었습니다."
    )

@router.get("/status/{journal_entry_id}", response_model=ComicGenerationResponse)
async def get_comic_generation_status(journal_entry_id: str):
    """만화 생성 상태 확인"""
    if journal_entry_id not in comic_generation_status:
        raise HTTPException(status_code=404, detail="만화 생성 작업을 찾을 수 없습니다.")
    
    return ComicGenerationResponse(**comic_generation_status[journal_entry_id])

@router.delete("/cancel/{journal_entry_id}")
async def cancel_comic_generation(journal_entry_id: str):
    """만화 생성 취소"""
    if journal_entry_id in comic_generation_status:
        comic_generation_status[journal_entry_id] = {
            "status": "cancelled",
            "progress": 0,
            "message": "만화 생성이 취소되었습니다.",
            "comic_data": None
        }
        return {"message": "만화 생성이 취소되었습니다."}
    
    raise HTTPException(status_code=404, detail="만화 생성 작업을 찾을 수 없습니다.") 