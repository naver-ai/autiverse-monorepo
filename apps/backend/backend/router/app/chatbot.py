from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional, List, Annotated
import asyncio
import json
import sys
import os
from sqlalchemy.orm import Session

# Add the backend directory to the path so we can import the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from backend.database.engine import get_session
from backend.database.crud.chatbot import get_dyad_by_id, get_dyad_places, get_place_people
from backend.chatbot_controller import ChatbotController
from backend.database.models import Dyad, Comic, JournalEntry, Journal
from backend.router.app.common import get_signed_in_dyad

router = APIRouter()

class StartChatbotRequest(BaseModel):
    location: Optional[str] = None
    people: Optional[List[str]] = None

class SendMessageRequest(BaseModel):
    journal_entry_id: str
    message: str

class ChatbotResponse(BaseModel):
    journal_entry_id: str
    response: str
    stage: str
    data: Optional[Dict[str, Any]] = None
    auto_comic_generation: Optional[bool] = None

@router.post("/start", response_model=ChatbotResponse)
def start_chatbot(
    request: StartChatbotRequest,
    dyad: Annotated[Dyad, Depends(get_signed_in_dyad)],
    db: Session = Depends(get_session)
):
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
            message=request.message
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

@router.get("/session/{journal_entry_id}")
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
    """갤러리에서 완성된 만화들 조회"""
    try:
        # 완성된 저널 엔트리들 조회 (status가 completed인 것들)
        completed_entries = db.query(JournalEntry).filter(
            JournalEntry.dyad_id == dyad.id,
            JournalEntry.status == "completed"
        ).all()
        
        gallery_items = []
        for entry in completed_entries:
            # 해당 저널 엔트리의 Comic 데이터 조회
            comic = db.query(Comic).filter(Comic.journal_entry_id == entry.id).first()
            
            # 완성된 패널 데이터 수집 (second_panel들만)
            panels = [
                comic.second_panel1,
                comic.second_panel2,
                comic.second_panel3,
                comic.second_panel4
            ]
            
            # Journal 테이블의 revision_2 데이터 조회
            journal = db.query(Journal).filter(Journal.journal_entry_id == entry.id).first()
            revision_2_content = journal.revision_2
            
            gallery_items.append({
                "id": comic.id,
                "journal_entry_id": entry.id,
                "created_at": entry.created_at.isoformat() if entry.created_at else None,
                "panels": panels,
                "revision_2": revision_2_content,
                "child_name": dyad.child_name,
                "agent_name": dyad.agents[0].agent_name if dyad.agents else "친구"
            })
        
        return {
            "dyad_id": dyad.id,
            "comics": gallery_items
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 