from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Dict, Any, Optional
from backend.database.crud.chatbot import update_comic_data, update_comic_status, get_comic_status, get_comic, get_journal_entry, get_dyad_by_id
from backend.database.models import ComicStatus, JournalEntryStage, UserLocale
from backend.core.ai import ComicGridGenerator, ComicGridGeneratorEng
from backend.database.engine import get_session
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated
from fastapi import Depends
from backend.core.ai.pipelines import Revision1Stage, Revision1StageEng, ComicContextStage, ComicContextStageEng

router = APIRouter()

# Status messages by locale (progress %, message)
STATUS_MAPPING_KR = {
    "generating-0": (0, "어떻게 그릴지 고민중이다~"),
    "generating-1": (20, "첫번째 칸을 그리고 있어!"),
    "generating-2": (40, "두번째 칸을 그리고 있어!"),
    "generating-3": (60, "세번째 칸을 그리고 있어!"),
    "generating-4": (80, "이제 마지막 칸이다!!"),
    "completed": (99, "만화 생성 완료!"),
    "error": (0, "만화 생성 중 오류가 발생했습니다."),
    "cancelled": (0, "만화 생성이 취소되었습니다."),
}
STATUS_MAPPING_EN = {
    "generating-0": (0, "Thinking about how to draw~"),
    "generating-1": (20, "Drawing the first panel!"),
    "generating-2": (40, "Drawing the second panel!"),
    "generating-3": (60, "Drawing the third panel!"),
    "generating-4": (80, "Now the last panel!!"),
    "completed": (99, "Comic generation complete!"),
    "error": (0, "An error occurred while generating the comic."),
    "cancelled": (0, "Comic generation has been cancelled."),
}
DEFAULT_UNKNOWN_KR = (0, "알 수 없는 상태")
DEFAULT_UNKNOWN_EN = (0, "Unknown status")

MESSAGES_KR = {"started": "만화 생성이 시작되었습니다.", "cancelled": "만화 생성이 취소되었습니다."}
MESSAGES_EN = {"started": "Comic generation has started.", "cancelled": "Comic generation has been cancelled."}


class ComicGenerationResponse(BaseModel):
    status: str
    progress: int
    message: str
    comic_data: Optional[Dict[str, Any]] = None


def get_progress_and_message(status: str, locale: Optional[UserLocale] = None) -> tuple[int, str]:
    """Return progress and message for status; locale selects KR vs EN (default EN if None)."""
    mapping = STATUS_MAPPING_EN if locale == UserLocale.English else STATUS_MAPPING_KR
    default = DEFAULT_UNKNOWN_EN if locale == UserLocale.English else DEFAULT_UNKNOWN_KR
    return mapping.get(status, default)

async def generate_comic_with_progress(journal_entry_id: str):
    """백그라운드에서 만화를 생성하고 진행률을 업데이트"""
    async for db in get_session():
        try:
            # 초기 상태 설정
            await update_comic_status(db, journal_entry_id, ComicStatus.Generating0, None)

            journal_entry = await get_journal_entry(db, journal_entry_id)
            print(f"[DEBUG] Comic generation in stage: {journal_entry.stage}")
            if journal_entry.stage == JournalEntryStage.Revision1:
                dyad = await get_dyad_by_id(db, journal_entry.dyad_id)
                Revision1StageClass = Revision1StageEng if dyad.locale == UserLocale.English else Revision1Stage
                stage = await Revision1StageClass.create(db, journal_entry_id)
                comic_data = await stage._generate_comic_panels()
                # 완료 상태 설정
                await update_comic_status(db, journal_entry_id, ComicStatus.Completed, comic_data)

            elif journal_entry.stage == JournalEntryStage.ComicContext:
                dyad = await get_dyad_by_id(db, journal_entry.dyad_id)
                ContextStageClass = ComicContextStageEng if dyad.locale == UserLocale.English else ComicContextStage
                stage = await ContextStageClass.create(db, journal_entry_id)
                comic_data = await stage._generate_final_comic_panels()
                # 완료 상태 설정
                await update_comic_status(db, journal_entry_id, ComicStatus.Completed, comic_data)
            
            else:  # TODO Check revision 2
                dyad = await get_dyad_by_id(db, journal_entry.dyad_id)
                GeneratorClass = ComicGridGeneratorEng if dyad.locale == UserLocale.English else ComicGridGenerator

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

                generator = GeneratorClass()
                comic_data = await generator.generate_comic_grids({}, progress_callback)
                
                print(f"[DEBUG] Comic generation completed for {journal_entry_id}")
                print(f"[DEBUG] Comic data: {comic_data}")
                
                # 완료 상태 설정
                await update_comic_status(db, journal_entry_id, ComicStatus.Completed, comic_data)
                
                print(f"[DEBUG] Status updated to completed for {journal_entry_id}")
                
                # 데이터베이스에 저장 - 현재 상태에 따라 적절한 패널에 저장
                comic = await get_comic(db, journal_entry_id)
                if comic:
                    # 기존 패널 데이터 확인하여 저장 위치 결정
                    if comic.first_panel1 is None:
                        # 첫 번째 만화로 저장
                        await update_comic_data(
                            db, journal_entry_id,
                            first_panel1=comic_data.get("panel1"),
                            first_panel2=comic_data.get("panel2"),
                            first_panel3=comic_data.get("panel3"),
                            first_panel4=comic_data.get("panel4")
                        )
                    else:
                        # 두 번째 만화로 저장
                        await update_comic_data(
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

def _get_message(key: str, locale: Optional[UserLocale]) -> str:
    """Return started/cancelled message by locale (default EN if None)."""
    if locale == UserLocale.English:
        return MESSAGES_EN[key]
    return MESSAGES_KR[key]


@router.post("/{journal_entry_id}/start", response_model=ComicGenerationResponse)
async def start_comic_generation(
    journal_entry_id: str,
    background_tasks: BackgroundTasks
):
    """Start comic generation."""
    async for db in get_session():
        try:
            locale = None
            journal_entry = await get_journal_entry(db, journal_entry_id)
            if journal_entry:
                dyad = await get_dyad_by_id(db, journal_entry.dyad_id)
                if dyad:
                    locale = dyad.locale

            current_status = await get_comic_status(db, journal_entry_id)
            if current_status and (current_status == ComicStatus.Generating0 or current_status == ComicStatus.Generating1 or current_status == ComicStatus.Generating2 or current_status == ComicStatus.Generating3 or current_status == ComicStatus.Generating4):
                progress, message = get_progress_and_message(current_status, locale)
                return ComicGenerationResponse(
                    status="generating",
                    progress=progress,
                    message=message
                )
            
            # Comic Generation Background Task
            background_tasks.add_task(
                generate_comic_with_progress,
                journal_entry_id
            )

            started_msg = _get_message("started", locale) if locale else MESSAGES_EN["started"]
            return ComicGenerationResponse(
                status="started",
                progress=0,
                message=started_msg
            )
        except Exception as e:
            print(f"[ERROR] Failed to start comic generation: {e}")
            return ComicGenerationResponse(
                status="error",
                progress=0,
                message=f"Error starting comic generation: {e}"
            )

@router.get("/{journal_entry_id}/status", response_model=ComicGenerationResponse)
async def get_comic_generation_status(journal_entry_id: str, db: Annotated[AsyncSession, Depends(get_session)]):
    """Get comic generation status."""
    try:
        locale = None
        journal_entry = await get_journal_entry(db, journal_entry_id)
        if journal_entry:
            dyad = await get_dyad_by_id(db, journal_entry.dyad_id)
            if dyad:
                locale = dyad.locale

        status = await get_comic_status(db, journal_entry_id)
        if status:
            print(f"[DEBUG] Comic generation status: {status}")
            progress, message = get_progress_and_message(status, locale)
            return ComicGenerationResponse(
                status=status,
                progress=progress,
                message=message
            )
        else:
            return ComicGenerationResponse(
                status="idle",
                progress=0,
                message=""
            )
    except Exception as e:
        print(f"[ERROR] Failed to get comic generation status: {e}")
        return {"message": f"Error getting comic generation status: {e}"} 

@router.delete("/{journal_entry_id}/cancel")
async def cancel_comic_generation(journal_entry_id: str):
    """Cancel comic generation."""
    async for db in get_session():
        try:
            locale = None
            journal_entry = await get_journal_entry(db, journal_entry_id)
            if journal_entry:
                dyad = await get_dyad_by_id(db, journal_entry.dyad_id)
                if dyad:
                    locale = dyad.locale

            await update_comic_status(db, journal_entry_id, ComicStatus.Cancelled, None)
            cancelled_msg = _get_message("cancelled", locale) if locale else MESSAGES_EN["cancelled"]
            return {"message": cancelled_msg}
        except Exception as e:
            print(f"[ERROR] Failed to cancel comic generation: {e}")
            return {"message": f"Error cancelling comic generation: {e}"} 