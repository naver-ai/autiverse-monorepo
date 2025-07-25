from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional
from backend.database.crud.chatbot import update_comic_data, update_comic_status, get_comic_status, get_comic, get_journal_entry
from backend.database.models import ComicStatus, JournalEntryStage
from backend.core.ai import ComicGridGenerator
from backend.database.engine import get_session
from sqlalchemy.orm import Session
from typing import Annotated
from fastapi import Depends
from backend.core.ai.pipelines.revision_1_stage import Revision1Stage
from backend.core.ai.pipelines.comic_context_stage import ComicContextStage

router = APIRouter()

class ComicGenerationResponse(BaseModel):
    status: str
    progress: int
    message: str
    comic_data: Optional[Dict[str, Any]] = None

def get_progress_and_message(status: str) -> tuple[int, str]:
    """상태 문자열에 따라 진행률과 메시지 반환"""
    status_mapping = {
        'generating-0': (0, "어떻게 그릴지 고민중이다~"),
        'generating-1': (20, "첫번째 칸을 그리고 있어!"),
        'generating-2': (40, "두번째 칸을 그리고 있어!"),
        'generating-3': (60, "세번째 칸을 그리고 있어!"),
        'generating-4': (80, "이제 마지막 칸이다!!"),
        'completed': (100, "만화 생성 완료!"),
        'error': (0, "만화 생성 중 오류가 발생했습니다."),
        'cancelled': (0, "만화 생성이 취소되었습니다.")
    }
    return status_mapping.get(status, (0, "알 수 없는 상태"))

async def generate_comic_with_progress(journal_entry_id: str):
    """백그라운드에서 만화를 생성하고 진행률을 업데이트"""
    db = next(get_session())
    try:
        # 초기 상태 설정
        await update_comic_status(db, journal_entry_id, ComicStatus.Generating0, None)

        journal_entry = get_journal_entry(db, journal_entry_id)
        if journal_entry.stage == JournalEntryStage.Revision1:
            stage = Revision1Stage(db, journal_entry_id)
            comic_data = await stage._generate_comic_panels()
            # 완료 상태 설정
            await update_comic_status(db, journal_entry_id, ComicStatus.Completed, comic_data)

        elif journal_entry.stage == JournalEntryStage.ComicContext:
            stage = ComicContextStage(db, journal_entry_id)
            comic_data = await stage._generate_final_comic_panels()
            # 완료 상태 설정
            await update_comic_status(db, journal_entry_id, ComicStatus.Completed, comic_data)
        
        else: #TODO Check revision 2
            # 실제 만화 생성 과정과 연동된 progress_callback 정의
            async def progress_callback(progress: int, message: str):
                """실제 만화 생성 진행률에 따라 상태 업데이트"""
                status = ComicStatus.Generating0
                if progress <= 20:
                    status = ComicStatus.Generating1
                elif progress <= 60:
                    status = ComicStatus.Generating2
                elif progress <= 75:
                    status = ComicStatus.Generating3
                elif progress <= 90:
                    status = ComicStatus.Generating4
                print(f"[DEBUG] Progress: {progress}% - {message}")

                await update_comic_status(db, journal_entry_id, status, None)
            
            # 실제 만화 생성 (progress_callback과 함께)
            generator = ComicGridGenerator()
            comic_data = await generator.generate_comic_grids({}, progress_callback)
            
            print(f"[DEBUG] Comic generation completed for {journal_entry_id}")
            print(f"[DEBUG] Comic data: {comic_data}")
            
            # 완료 상태 설정
            await update_comic_status(db, journal_entry_id, ComicStatus.Completed, comic_data)
            
            print(f"[DEBUG] Status updated to completed for {journal_entry_id}")
            
            # 데이터베이스에 저장 - 현재 상태에 따라 적절한 패널에 저장
            comic = get_comic(db, journal_entry_id)
            if comic:
                # 기존 패널 데이터 확인하여 저장 위치 결정
                if comic.first_panel1 is None:
                    # 첫 번째 만화로 저장
                    update_comic_data(
                        db, journal_entry_id,
                        first_panel1=comic_data.get("panel1"),
                        first_panel2=comic_data.get("panel2"),
                        first_panel3=comic_data.get("panel3"),
                        first_panel4=comic_data.get("panel4")
                    )
                else:
                    # 두 번째 만화로 저장
                    update_comic_data(
                        db, journal_entry_id,
                        second_panel1=comic_data.get("panel1"),
                        second_panel2=comic_data.get("panel2"),
                        second_panel3=comic_data.get("panel3"),
                        second_panel4=comic_data.get("panel4")
                    )
        
    except Exception as e:
        # 에러 상태 설정
        await update_comic_status(db, journal_entry_id, ComicStatus.Error, None)
        print(f"[ERROR] Comic generation failed for {journal_entry_id}: {e}")
    finally:
        db.close()

@router.post("/{journal_entry_id}/start", response_model=ComicGenerationResponse)
async def start_comic_generation(
    journal_entry_id: str,
    background_tasks: BackgroundTasks
):
    """만화 생성 시작"""
    
    # 이미 생성 중인지 확인
    db = next(get_session())
    try:
        current_status = get_comic_status(db, journal_entry_id)
        if current_status and (current_status == ComicStatus.Generating0 or current_status == ComicStatus.Generating1 or current_status == ComicStatus.Generating2 or current_status == ComicStatus.Generating3 or current_status == ComicStatus.Generating4):
            progress, message = get_progress_and_message(current_status)
            return ComicGenerationResponse(
                status="generating",
                progress=progress,
                message=message
            )
        
        # 백그라운드에서 만화 생성 시작
        background_tasks.add_task(
            generate_comic_with_progress,
            journal_entry_id
        )
        
        return ComicGenerationResponse(
            status="started",
            progress=0,
            message="만화 생성이 시작되었습니다."
        )
    finally:
        db.close()

@router.get("/{journal_entry_id}/status", response_model=ComicGenerationResponse)
async def get_comic_generation_status(journal_entry_id: str, db: Annotated[Session, Depends(get_session)]):
    """만화 생성 상태 조회"""
    try:
        status = get_comic_status(db, journal_entry_id)
        if not status:
            raise HTTPException(status_code=404, detail="만화 생성 작업을 찾을 수 없습니다.")
        
        progress, message = get_progress_and_message(status)
        return ComicGenerationResponse(
            status=status,
            progress=progress,
            message=message
        )
    finally:
        db.close()

@router.delete("/{journal_entry_id}/cancel")
async def cancel_comic_generation(journal_entry_id: str):
    """만화 생성 취소"""
    db = next(get_session())
    try:
        await update_comic_status(db, journal_entry_id, ComicStatus.Cancelled, None)
        return {"message": "만화 생성이 취소되었습니다."}
    finally:
        db.close() 