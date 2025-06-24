from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import asyncio
import json
import sys
import os

# Add the backend directory to the path so we can import the modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from comic_intro import Chatbot, EventAnalysis
from comic_context import ComicContextGenerator
from revision_1 import ComicRevisionSystem as Revision1System
from revision_2 import ComicRevisionSystem as Revision2System

router = APIRouter()

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    session_id: str
    stage: str
    data: Optional[Dict[str, Any]] = None

class ComicData(BaseModel):
    panels: Dict[str, Any]
    session_id: str

# Store active sessions
sessions: Dict[str, Dict[str, Any]] = {}

@router.post("/start", response_model=ChatResponse)
async def start_chatbot():
    """Start a new chatbot session"""
    session_id = f"session_{len(sessions) + 1}"
    
    # Initialize chatbot
    chatbot = Chatbot()
    
    sessions[session_id] = {
        "chatbot": chatbot,
        "stage": "intro",
        "events": [],
        "summary": "",
        "comic_data": None,
        "revision_count": 0
    }
    
    # Get initial message
    initial_response = await chatbot.process_message("")
    
    return ChatResponse(
        response=initial_response,
        session_id=session_id,
        stage="intro"
    )

@router.post("/message", response_model=ChatResponse)
async def send_message(message: ChatMessage):
    """Send a message to the chatbot"""
    if not message.session_id or message.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[message.session_id]
    chatbot = session["chatbot"]
    
    # Process message based on current stage
    if session["stage"] == "intro":
        response = await chatbot.process_message(message.message)
        
        # Check if intro is complete
        if chatbot.is_conversation_complete():
            session["stage"] = "revision_1"
            session["events"] = chatbot.context.events
            session["summary"] = chatbot.get_final_summary()
            
            # Generate initial comic data
            comic_generator = ComicContextGenerator(
                json.dumps({
                    "panel1": {"content": None, "missing_content": "이벤트 1"},
                    "panel2": {"content": None, "missing_content": "이벤트 2"},
                    "panel3": {"content": None, "missing_content": "이벤트 3"},
                    "panel4": {"content": None, "missing_content": "감정"}
                })
            )
            
            # Complete the comic
            await comic_generator.run_comic_conversation()
            session["comic_data"] = comic_generator.get_final_result()
            
            return ChatResponse(
                response="좋아! 이제 만화를 만들어볼게. 먼저 틀린 부분이 있는지 확인해보자! 🤔",
                session_id=message.session_id,
                stage="revision_1",
                data={
                    "panels": session["comic_data"],
                    "events": session["events"],
                    "summary": session["summary"]
                }
            )
        
        return ChatResponse(
            response=response,
            session_id=message.session_id,
            stage="intro"
        )
    
    elif session["stage"] == "revision_1":
        # Handle revision 1
        revision_system = Revision1System(json.dumps(session["comic_data"]))
        
        if message.message.lower() in ['아니', '아니요', 'no', 'n']:
            session["stage"] = "comic_context"
            return ChatResponse(
                response="좋아! 그럼 이제 만화를 더 완성해볼게! 🎨",
                session_id=message.session_id,
                stage="comic_context",
                data={"panels": session["comic_data"]}
            )
        elif message.message.lower() in ['응', '네', 'yes', 'y']:
            session["stage"] = "revision_1_correction"
            return ChatResponse(
                response="어디가 어떻게 틀렸어? 😅",
                session_id=message.session_id,
                stage="revision_1_correction",
                data={"panels": session["comic_data"]}
            )
        else:
            return ChatResponse(
                response="응 아니 중에 골라줘! 😅",
                session_id=message.session_id,
                stage="revision_1",
                data={"panels": session["comic_data"]}
            )
    
    elif session["stage"] == "revision_1_correction":
        # Apply revision 1 correction
        revision_system = Revision1System(json.dumps(session["comic_data"]))
        await revision_system._apply_revision(message.message)
        session["comic_data"] = revision_system.comic_generator.get_final_result()
        session["stage"] = "revision_1"
        
        return ChatResponse(
            response="네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까? 🤔",
            session_id=message.session_id,
            stage="revision_1",
            data={"panels": session["comic_data"]}
        )
    
    elif session["stage"] == "comic_context":
        # Handle comic context completion
        comic_generator = ComicContextGenerator(json.dumps(session["comic_data"]))
        
        # Process the message to complete missing panels
        await comic_generator.reconstruct_panel(message.message, "사용자 입력")
        
        if comic_generator.is_complete():
            session["comic_data"] = comic_generator.get_final_result()
            session["stage"] = "revision_2"
            
            return ChatResponse(
                response="완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔",
                session_id=message.session_id,
                stage="revision_2",
                data={"panels": session["comic_data"]}
            )
        else:
            # Get next question
            next_question = await comic_generator.get_next_question()
            return ChatResponse(
                response=next_question or "다음에 대해 말해줘!",
                session_id=message.session_id,
                stage="comic_context",
                data={"panels": session["comic_data"]}
            )
    
    elif session["stage"] == "revision_2":
        # Handle revision 2
        if message.message.lower() in ['아니', '아니요', 'no', 'n']:
            session["stage"] = "complete"
            return ChatResponse(
                response="완벽하네! 만화일기 완성이닷! 🏅",
                session_id=message.session_id,
                stage="complete",
                data={"panels": session["comic_data"]}
            )
        elif message.message.lower() in ['응', '네', 'yes', 'y']:
            session["stage"] = "revision_2_correction"
            return ChatResponse(
                response="어디를 어떻게 수정해볼까?? 🤔",
                session_id=message.session_id,
                stage="revision_2_correction",
                data={"panels": session["comic_data"]}
            )
        else:
            return ChatResponse(
                response="응 아니 중에 골라줘! 😅",
                session_id=message.session_id,
                stage="revision_2",
                data={"panels": session["comic_data"]}
            )
    
    elif session["stage"] == "revision_2_correction":
        # Apply revision 2 correction
        revision_system = Revision2System(json.dumps(session["comic_data"]))
        await revision_system._apply_revision(message.message)
        session["comic_data"] = revision_system.comic_generator.get_final_result()
        session["stage"] = "revision_2"
        
        return ChatResponse(
            response="네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까? 🤔",
            session_id=message.session_id,
            stage="revision_2",
            data={"panels": session["comic_data"]}
        )
    
    else:
        return ChatResponse(
            response="만화가 완성되었어! 새로운 만화를 시작하려면 /start를 사용해줘! 🎉",
            session_id=message.session_id,
            stage="complete",
            data={"panels": session["comic_data"]}
        )

@router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session data"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session = sessions[session_id]
    return {
        "session_id": session_id,
        "stage": session["stage"],
        "events": session["events"],
        "summary": session["summary"],
        "comic_data": session["comic_data"]
    }

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    del sessions[session_id]
    return {"message": "Session deleted"} 