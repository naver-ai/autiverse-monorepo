from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from .database.crud.chatbot import (
    get_dyad_by_passcode, get_dyad_by_id, create_journal_entry, get_journal_entry, 
    create_journal, get_journal, update_journal_data, 
    get_messages_by_journal_entry, delete_journal_entry, reset_journal_entry
)
from .database.models import JournalEntryStage, JournalEntryStatus
from .comic_intro_stage import ComicIntroStage
from .revision_1_stage import Revision1Stage
from .comic_context_stage import ComicContextStage
from .revision_2_stage import Revision2Stage

class ChatbotController:
    def __init__(self, db: Session):
        self.db = db
        self.current_journal_entry_id: Optional[str] = None
        
    def start_chatbot(self, dyad_id: str, location: str = None, people: List[str] = None) -> Dict[str, Any]:
        """챗봇 시작"""
        # dyad_id로 dyad 조회
        dyad = get_dyad_by_id(self.db, dyad_id)
        if not dyad:
            raise ValueError("Invalid dyad_id")
        
        # 새로운 journal entry 생성
        journal_entry = create_journal_entry(self.db, dyad_id)
        self.current_journal_entry_id = journal_entry.id
        
        # journal 생성
        journal = create_journal(self.db, journal_entry.id, dyad_id, location, people)
        
        # Comic 테이블 생성 (comic generation을 위해 필요)
        from .database.crud.chatbot import create_comic
        create_comic(self.db, journal_entry.id, journal.id, dyad_id)
        
        # comic intro 단계 시작
        intro_stage = ComicIntroStage(self.db, journal_entry.id)
        initial_message = intro_stage.start_conversation(location, people)
        
        return {
            "journal_entry_id": journal_entry.id,
            "response": initial_message,
            "stage": "intro"
        }
    
    def send_message(self, journal_entry_id: str, message: str) -> Dict[str, Any]:
        """메시지 전송"""
        # journal entry 조회
        journal_entry = get_journal_entry(self.db, journal_entry_id)
        if not journal_entry:
            raise ValueError("Journal entry not found")
        
        # 현재 단계에 따라 적절한 핸들러 호출
        current_stage = journal_entry.stage
        
        if current_stage == JournalEntryStage.Intro:
            return self._handle_intro_stage(journal_entry_id, message)
        elif current_stage == JournalEntryStage.Revision1 or current_stage == JournalEntryStage.ComicContext or current_stage == JournalEntryStage.Revision2:
            return self._handle_drawing_stage(journal_entry_id, message)
        else:
            return {
                "response": "대화가 완료되었습니다.",
                "stage": "complete"
            }
    
    def _handle_intro_stage(self, journal_entry_id: str, message: str) -> Dict[str, Any]:
        """인트로 단계 처리"""
        intro_stage = ComicIntroStage(self.db, journal_entry_id)
        
        # 메시지 처리
        response = intro_stage.process_message(message)
        
        # 이벤트 분석
        analysis = intro_stage.analyze_events()
        
        # 다음 단계로 진행할 준비가 되었는지 확인
        if intro_stage.is_ready_for_next_stage():
            # revision_1 단계로 전환
            revision_stage = Revision1Stage(self.db, journal_entry_id)
            revision_response = revision_stage.start_revision()
            
            return {
                "response": revision_response,
                "stage": "revision_1",
                "data": {
                    "events": analysis.get("events_identified", []),
                    "summary": analysis.get("conversation_summary", ""),
                    "panels": analysis.get("comic_panels", {})
                }
            }
        
        return {
            "response": response,
            "stage": "intro"
        }
    
    def _handle_drawing_stage(self, journal_entry_id: str, message: str) -> Dict[str, Any]:
        """그리기 단계 처리 (revision_1, comic_context, revision_2)"""
        journal_entry = get_journal_entry(self.db, journal_entry_id)
        journal = get_journal(self.db, journal_entry_id)
        
        if not journal:
            return {"response": "Journal not found", "stage": "error"}
        
        # 현재 단계에 따라 적절한 핸들러 호출
        current_stage = journal_entry.stage
        
        if current_stage == JournalEntryStage.Revision1:
            return self._handle_revision_1_stage(journal_entry_id, message)
        elif current_stage == JournalEntryStage.ComicContext:
            return self._handle_comic_context_stage(journal_entry_id, message)
        elif current_stage == JournalEntryStage.Revision2:
            return self._handle_revision_2_stage(journal_entry_id, message)
        else:
            # 완료
            return {
                "response": "대화가 완료되었습니다.",
                "stage": "complete"
            }
    
    def _handle_revision_1_stage(self, journal_entry_id: str, message: str) -> Dict[str, Any]:
        """revision_1 단계 처리"""
        revision_stage = Revision1Stage(self.db, journal_entry_id)
        response = revision_stage.process_message(message)
        
        # 다음 단계로 전환할지 확인
        if "좋아! 그럼 이제 만화를 더 완성해볼게! 🎨" in response:
            # comic_context 단계로 전환
            context_stage = ComicContextStage(self.db, journal_entry_id)
            context_response = context_stage.start_context_analysis()
            
            return {
                "response": context_response,
                "stage": "comic_context"
            }
        
        return {
            "response": response,
            "stage": "revision_1"
        }
    
    def _handle_comic_context_stage(self, journal_entry_id: str, message: str) -> Dict[str, Any]:
        """comic_context 단계 처리"""
        context_stage = ComicContextStage(self.db, journal_entry_id)
        response = context_stage.process_message(message)
        
        # 완료되었는지 확인
        if context_stage.is_complete():
            # revision_2 단계로 전환
            revision2_stage = Revision2Stage(self.db, journal_entry_id)
            revision2_response = revision2_stage.start_revision()
            
            return {
                "response": revision2_response,
                "stage": "revision_2"
            }
        
        return {
            "response": response,
            "stage": "comic_context"
        }
    
    def _handle_revision_2_stage(self, journal_entry_id: str, message: str) -> Dict[str, Any]:
        """revision_2 단계 처리"""
        revision2_stage = Revision2Stage(self.db, journal_entry_id)
        response = revision2_stage.process_message(message)
        
        # 완료되었는지 확인
        if "이제 만화일기 완성이닷" in response:
            return {
                "response": response,
                "stage": "complete"
            }
        
        return {
            "response": response,
            "stage": "revision_2"
        }
    
    def get_session_info(self, journal_entry_id: str) -> Dict[str, Any]:
        """세션 정보 조회"""
        journal_entry = get_journal_entry(self.db, journal_entry_id)
        if not journal_entry:
            raise ValueError("Journal entry not found")
        
        journal = get_journal(self.db, journal_entry_id)
        messages = get_messages_by_journal_entry(self.db, journal_entry_id)
        
        # Comic 테이블에서 comic 데이터 조회
        from .database.crud.chatbot import get_comic
        comic = get_comic(self.db, journal_entry_id)
        
        # 현재 패널 데이터 결정
        current_panels = {}
        if journal:
            # 현재 단계에 따라 적절한 패널 데이터 선택
            if journal_entry.stage == JournalEntryStage.Complete:
                # 완료 단계에서는 revision_2 우선, 없으면 comic_context 사용
                current_panels = journal.revision_2 if journal.revision_2 else journal.comic_context
            elif journal_entry.stage == JournalEntryStage.Revision2:
                # revision_2가 있으면 그것을 사용, 없으면 comic_context 사용
                current_panels = journal.revision_2 if journal.revision_2 else journal.comic_context
            elif journal_entry.stage == JournalEntryStage.ComicContext and journal.comic_context:
                current_panels = journal.comic_context
            elif journal_entry.stage == JournalEntryStage.Revision1 and journal.revision_1:
                current_panels = journal.revision_1
            elif journal.comic_intro:
                # comic_intro 데이터가 있으면 우선 사용
                current_panels = journal.comic_intro
        
        # Comic 테이블의 grid 데이터와 Journal 테이블의 텍스트 데이터를 결합
        if comic and current_panels:
            # 각 패널에 대해 Comic 테이블의 grid 데이터 추가
            for i in range(1, 5):
                panel_key = f"panel{i}"
                if panel_key in current_panels:
                    # 현재 단계에 따라 적절한 comic 데이터 선택
                    if journal_entry.stage == JournalEntryStage.Complete or journal_entry.stage == JournalEntryStage.Revision2:
                        # 완료 단계에서는 second_panel 사용
                        comic_panel = getattr(comic, f"second_panel{i}", None)
                    else:
                        # 그 외 단계에서는 first_panel 사용
                        comic_panel = getattr(comic, f"first_panel{i}", None)
                    
                    if comic_panel:
                        # 기존 텍스트 데이터에 grid 데이터 추가
                        if isinstance(current_panels[panel_key], dict):
                            current_panels[panel_key]["grid"] = comic_panel.get("grid", [])
                        else:
                            # 문자열인 경우 dict로 변환
                            current_panels[panel_key] = {
                                "content": current_panels[panel_key],
                                "grid": comic_panel.get("grid", [])
                            }
        
        return {
            "journal_entry_id": journal_entry_id,
            "stage": journal_entry.stage.value if journal_entry.stage else "intro",
            "status": journal_entry.status.value if journal_entry.status else "initial",
            "location": journal.location if journal else None,
            "people": journal.people if journal else None,
            "events": journal.events if journal else None,
            "summary": journal.summary if journal else None,
            "panels": current_panels,
            "message_count": len(messages) if messages else 0
        }
    
    def reset_session(self, journal_entry_id: str) -> Dict[str, Any]:
        """세션 초기화"""
        reset_journal_entry(self.db, journal_entry_id)
        
        return {
            "response": "세션이 초기화되었습니다.",
            "stage": "intro"
        }
    
    def delete_session(self, journal_entry_id: str) -> bool:
        """세션 삭제"""
        return delete_journal_entry(self.db, journal_entry_id) 