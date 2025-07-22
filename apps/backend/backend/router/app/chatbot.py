from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Annotated
import asyncio
import json
import sys
import os
from sqlalchemy.orm import Session
import uuid
from datetime import datetime
import shutil

# Add the backend directory to the path so we can import the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database.engine import get_session
from backend.database.crud.chatbot import get_dyad_by_id, get_dyad_places, get_place_people, generate_audio_filename
from backend.core.ai import ChatbotController
from backend.database.models import Dyad, Comic, JournalEntry, Journal, Message, MessageRole, JournalEntryStage, InteractionTurn, JournalingSessionInfo
from backend.router.app.common import get_signed_in_dyad
from backend.utils.environment import FilePaths

router = APIRouter()

class StartChatbotRequest(BaseModel):
    location: Optional[str] = None
    people: Optional[List[str]] = None

class SendMessageRequest(BaseModel):
    journal_entry_id: str
    message: str
    audio_filename: Optional[str] = None

class ChatbotResponse(BaseModel):
    journal_entry_id: str
    response: str
    stage: str
    data: Optional[Dict[str, Any]] = None
    auto_comic_generation: Optional[bool] = None

class UpdateTitleRequest(BaseModel):
    journal_entry_id: str
    title: str

class ContinueSessionRequest(BaseModel):
    journal_entry_id: str
    stage: str

@router.post("/start", response_model=ChatbotResponse)
def start_chatbot(
    request: StartChatbotRequest,
    dyad: Annotated[Dyad, Depends(get_signed_in_dyad)],
    db: Session = Depends(get_session)
):
    
    print("dyad id: ", dyad.id)
    print("location: ", request.location)
    print("people: ", request.people)

    """챗봇 시작"""
    try:
        controller = ChatbotController(db)
        result = controller.start_chatbot(
            dyad_id=dyad.id,
            location=request.location,
            people=request.people
        )
        
        return ChatbotResponse(
            journal_entry_id=result["journal_entry_id"],
            response=result["response"],
            stage=result["stage"],
            data=result.get("data"),
            auto_comic_generation=result.get("auto_comic_generation")
        )
    except ValueError as e:
        print(f"[DEBUG] ValueError: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/start-with-suggestion", response_model=ChatbotResponse)
def start_chatbot_with_suggestion(
    dyad: Annotated[Dyad, Depends(get_signed_in_dyad)],
    db: Session = Depends(get_session)
):
    """챗봇 시작 (뭘 쓸지 모르겠네 버튼용)"""
    try:
        controller = ChatbotController(db)
        result = controller.start_chatbot_with_suggestion(
            dyad_id=dyad.id
        )
        
        return ChatbotResponse(
            journal_entry_id=result["journal_entry_id"],
            response=result["response"],
            stage=result["stage"],
            data=result.get("data"),
            auto_comic_generation=result.get("auto_comic_generation")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/send", response_model=ChatbotResponse)
def send_message(
    request: SendMessageRequest,
    db: Session = Depends(get_session)
):
    """메시지 전송"""
    try:
        controller = ChatbotController(db)
        result = controller.send_message(
            journal_entry_id=request.journal_entry_id,
            message=request.message,
            audio_filename=request.audio_filename
        )
        
        return ChatbotResponse(
            journal_entry_id=request.journal_entry_id,
            response=result["response"],
            stage=result["stage"],
            data=result.get("data"),
            auto_comic_generation=result.get("auto_comic_generation")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/session/{journal_entry_id}", response_model=JournalingSessionInfo)
def get_session_info(
    journal_entry_id: str,
    db: Session = Depends(get_session)
):
    """세션 정보 조회"""
    try:
        controller = ChatbotController(db)
        return controller.get_session_info(journal_entry_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/reset/{journal_entry_id}")
def reset_session(
    journal_entry_id: str,
    db: Session = Depends(get_session)
):
    """세션 초기화"""
    try:
        controller = ChatbotController(db)
        result = controller.reset_session(journal_entry_id)
        
        return ChatbotResponse(
            journal_entry_id=journal_entry_id,
            response=result["response"],
            stage=result["stage"],
            auto_comic_generation=result.get("auto_comic_generation")
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/dyad/{dyad_id}/places")
def get_places(
    dyad: Annotated[Dyad, Depends(get_signed_in_dyad)],
    db: Session = Depends(get_session),
):
    places = get_dyad_places(db, dyad.id)
    return {
            "dyad_id": dyad.id,
            "places": [
                {
                    "id": place.id,
                    "name": place.name,
                    "monday": place.monday,
                    "tuesday": place.tuesday,
                    "wednesday": place.wednesday,
                    "thursday": place.thursday,
                    "friday": place.friday,
                    "saturday": place.saturday,
                    "sunday": place.sunday
                }
                for place in places
            ]
        }

@router.get("/place/{place_id}/people")
def get_people(
    place_id: str,
    db: Session = Depends(get_session)
):
    """place에 연결된 people 조회"""
    try:
        people = get_place_people(db, place_id)
        return {
            "place_id": place_id,
            "people": [
                {
                    "id": person.id,
                    "name": person.name,
                    "avatar_config": person.avatar_config
                }
                for person in people
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.delete("/session/{journal_entry_id}")
def delete_session(
    journal_entry_id: str,
    db: Session = Depends(get_session)
):
    """세션 삭제"""
    try:
        controller = ChatbotController(db)
        success = controller.delete_session(journal_entry_id)
        
        if success:
            return {"message": "Session deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/auto-comic-generation/{journal_entry_id}", response_model=ChatbotResponse)
def start_auto_comic_generation(
    journal_entry_id: str,
    db: Session = Depends(get_session)
):
    """자동 만화 생성 시작"""
    try:
        controller = ChatbotController(db)
        result = controller.start_auto_comic_generation(journal_entry_id)
        
        return ChatbotResponse(
            journal_entry_id=journal_entry_id,
            response=result["response"],
            stage=result["stage"],
            data=result.get("data"),
            auto_comic_generation=result.get("auto_comic_generation")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 

@router.get("/gallery")
def get_gallery(
    dyad: Annotated[Dyad, Depends(get_signed_in_dyad)],
    db: Session = Depends(get_session)
):
    """갤러리에서 stage가 intro가 아닌 모든 만화들 조회"""
    try:
        # stage가 intro와 revision_1이 아닌 모든 저널 엔트리들 조회 (최신순 정렬)
        journal_entries = db.query(JournalEntry).filter(
            JournalEntry.dyad_id == dyad.id,
            JournalEntry.stage != "intro",
            JournalEntry.stage != "revision_1"
        ).order_by(JournalEntry.created_at.desc()).all()
        
        gallery_items = []
        for entry in journal_entries:
            # 해당 저널 엔트리의 Comic 데이터 조회
            comic = db.query(Comic).filter(Comic.journal_entry_id == entry.id).first()
            
            # stage별로 적절한 panel 선택 (comic은 항상 second_panel 우선, 없으면 first_panel)
            panels = []
            if comic:
                panels = [
                    comic.second_panel1 or comic.first_panel1,
                    comic.second_panel2 or comic.first_panel2,
                    comic.second_panel3 or comic.first_panel3,
                    comic.second_panel4 or comic.first_panel4
                ]
                # None 값 제거
                panels = [panel for panel in panels if panel is not None]
            
            # Journal 테이블의 stage별 데이터 조회
            journal = db.query(Journal).filter(Journal.journal_entry_id == entry.id).first()
            
            # stage별로 적절한 Journal 데이터 선택
            journal_data = None
            if journal:
                if entry.stage == "comic_context":
                    # comic_context: comic_context 데이터 사용
                    journal_data = journal.comic_context or journal.revision_1
                elif entry.stage == "revision_2":
                    # revision_2: revision_2 데이터 사용
                    journal_data = journal.revision_2 or journal.comic_context
                elif entry.stage == "complete":
                    # complete: revision_2 데이터 사용 (최종 완성된 데이터)
                    journal_data = journal.revision_2
                else:
                    # 기타 stage: revision_2가 있으면 사용, 없으면 revision_1 사용
                    journal_data = journal.revision_2 or journal.revision_1
            
            gallery_items.append({
                "id": comic.id if comic else None,
                "journal_entry_id": entry.id,
                "stage": entry.stage,
                "status": entry.status,
                "title": journal.title if journal else None,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
                "panels": panels,
                "revision_2": journal_data,  # stage별로 선택된 Journal 데이터
                "child_name": dyad.child_name,
                "agent_name": dyad.agents[0].agent_name if dyad.agents else "친구"
            })
        
        return {
            "dyad_id": dyad.id,
            "comics": gallery_items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 

@router.post("/upload-audio")
async def upload_audio(
    file: UploadFile = File(...),
    journal_entry_id: str = Form(None),
    interaction_turn_id: str = Form(None),
    stage: str = Form(None),
    db: Session = Depends(get_session)
):
    """오디오 파일 업로드 및 저장"""
    try:
        # 파일 확장자 검증
        if not file.filename or not file.filename.lower().endswith(('.m4a', '.mp3', '.wav')):
            raise HTTPException(status_code=400, detail="지원하지 않는 오디오 파일 형식입니다.")
        
        # journal_entry_id와 stage가 제공된 경우 의미있는 파일명 생성
        if journal_entry_id and stage and stage.strip():
            unique_filename = generate_audio_filename(journal_entry_id, stage, db)
            # journal entry별 폴더에 저장
            file_path = FilePaths.get_journal_audio_file_path(journal_entry_id, unique_filename)
        else:
            # fallback: UUID 사용 (루트 audio 폴더에 저장)
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            file_path = FilePaths.get_audio_file_path(unique_filename)
        
        # 파일 저장
        print(f"[DEBUG] Saving file to: {file_path}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return {
            "filename": unique_filename,
            "original_filename": file.filename,
            "file_path": file_path
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파일 업로드 실패: {str(e)}") 

@router.post("/update-title", response_model=Dict[str, Any])
def update_comic_title(
    request: UpdateTitleRequest,
    db: Session = Depends(get_session)
):
    """만화 제목 업데이트"""
    try:
        from backend.database.crud.chatbot import get_journal, update_journal_data
        journal = get_journal(db, request.journal_entry_id)
        
        if journal:
            update_journal_data(db, request.journal_entry_id, title=request.title)
            return {"success": True, "title": request.title}
        else:
            raise HTTPException(status_code=404, detail="Journal not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/continue-session", response_model=Dict[str, Any])
def continue_session(
    request: ContinueSessionRequest,
    db: Session = Depends(get_session)
):
    """이어쓰기 세션 시작 - 메시지 metadata에 이어쓰기 시작 시점 기록"""
    try:
        from backend.database.crud.chatbot import get_latest_interaction_turn, get_messages_by_interaction_turn
        
        # 가장 최근 interaction turn 가져오기
        latest_turn = get_latest_interaction_turn(db, request.journal_entry_id)
        if not latest_turn:
            raise HTTPException(status_code=404, detail="No interaction turn found")
        
        # 해당 interaction turn의 가장 최근 메시지 가져오기
        messages = get_messages_by_interaction_turn(db, latest_turn.id)
        if not messages:
            raise HTTPException(status_code=404, detail="No messages found")
        
        latest_message = messages[-1]  # 가장 최근 메시지
        
        # 이어쓰기 시작 시점을 metadata에 기록
        continue_metadata = {
            "type": "continue_session",
            "timestamp": datetime.now().isoformat(),
            "stage": request.stage,
            "action": "user_continued_session"
        }
        
        # 기존 metadata가 있으면 병합, 없으면 새로 생성
        existing_metadata = latest_message.metadata_json or {}
        updated_metadata = {**existing_metadata, **continue_metadata}
        
        # 메시지의 metadata 업데이트
        latest_message.metadata_json = updated_metadata
        db.commit()
        db.refresh(latest_message)
        
        return {
            "success": True,
            "message_id": latest_message.id,
            "metadata": updated_metadata
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 