from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.database.crud.chatbot import (
    get_journal, update_journal_data, create_interaction_turn, 
    create_message, get_messages_by_journal_entry_and_stage
)
from backend.database.models import JournalEntryStage, MessageRole
from .title_generator import TitleGenerator

class TitleStage:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.title_generator = TitleGenerator()
        
    def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name or "친구"
        return "친구"
    
    def start_title_selection(self) -> str:
        """제목 선택 시작"""
        try:
            # Journal entry stage 업데이트
            from backend.database.crud.chatbot import update_journal_entry_stage
            update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Title)
            
            # 새로운 interaction turn 생성
            interaction_turn = create_interaction_turn(
                self.db, self.journal_entry_id, JournalEntryStage.Title
            )
            
            # 만화 데이터 가져오기
            journal = get_journal(self.db, self.journal_entry_id)
            if not journal:
                return "만화 데이터를 찾을 수 없어요."
            
            # 최종 만화 데이터 선택 (revision_2 우선, 없으면 comic_context)
            comic_data = journal.revision_2 if journal.revision_2 else journal.comic_context
            if not comic_data:
                return "만화 데이터를 찾을 수 없어요."
            
            # AI 제목 생성
            child_name = self._get_child_name()
            generated_title = self.title_generator.generate_title(comic_data, child_name)
            
            # 제목을 바로 데이터베이스에 저장
            self._save_title(generated_title)
            
            # 첫 번째 질문 생성
            initial_question = f"우리 오늘 일기의 제목은 뭐로 할까? {generated_title} 어때??"
            
            create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                initial_question, MessageRole.Assistant, JournalEntryStage.Title
            )
            
            return initial_question
            
        except Exception as e:
            print(f"[DEBUG] title_stage: Error in start_title_selection: {e}")
            raise
    
    def process_message(self, user_message: str, audio_filename: str = None) -> str:
        """사용자 메시지 처리"""
        print(f"[DEBUG] title_stage: process_message called with user_message='{user_message}'")
        
        try:
            # 현재 interaction turn 가져오기
            interaction_turn = self._get_or_create_interaction_turn(JournalEntryStage.Complete)
            
            # 사용자 메시지 저장
            create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                user_message, MessageRole.User, JournalEntryStage.Title,
                audio_filename=audio_filename
            )
            
            child_name = self._get_child_name()
            
            # 이전 메시지들을 확인하여 현재 상황 판단
            messages = get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.Title)
            
            # 마지막 Assistant 메시지 확인
            last_assistant_message = None
            for message in reversed(messages):
                if message.role == MessageRole.Assistant:
                    last_assistant_message = message.content
                    break
            
            if not last_assistant_message:
                return "미안해! 다시 말해줘! 😅"
            
            # 마지막 메시지에 따라 처리
            if "어때??" in last_assistant_message:
                # 첫 번째 제목 제안에 대한 피드백
                response = self.title_generator.process_title_feedback(user_message, "", child_name)
                
            elif "이걸로 할까??" in last_assistant_message:
                # 커스텀 제목 확인에 대한 피드백
                response = self.title_generator.process_custom_title_feedback(user_message, "", child_name)
                
            elif "그럼 어떤 제목으로 하고 싶어?" in last_assistant_message:
                # 커스텀 제목 입력
                self._save_title(user_message.strip())
                response = self.title_generator.confirm_custom_title(user_message.strip(), child_name)
                
            else:
                response = "미안해! 다시 말해줘! 😅"
            
            print(f"[DEBUG] title_stage: Response: {response}")
            
            # 봇 응답 저장
            create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                response, MessageRole.Assistant, JournalEntryStage.Title
            )
            
            return response
            
        except Exception as e:
            print(f"[DEBUG] title_stage: Error in process_message: {e}")
            import traceback
            traceback.print_exc()
            return "미안해! 다시 말해줘! 😅"
    
    def _save_title(self, title: str) -> None:
        """제목을 데이터베이스에 저장"""
        try:
            print(f"[DEBUG] title_stage: Saving title: '{title}'")
            result = update_journal_data(self.db, self.journal_entry_id, title=title)
            if result:
                print(f"[DEBUG] title_stage: Title saved successfully: {result.title}")
            else:
                print(f"[DEBUG] title_stage: Failed to save title")
        except Exception as e:
            print(f"[DEBUG] title_stage: Error saving title: {e}")
    
    def _get_or_create_interaction_turn(self, stage: JournalEntryStage):
        """현재 interaction turn 가져오기 또는 생성"""
        from backend.database.crud.chatbot import get_latest_interaction_turn, create_interaction_turn
        
        # 현재 stage의 interaction turn 찾기
        latest_turn = get_latest_interaction_turn(self.db, self.journal_entry_id)
        
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        
        # 새로운 interaction turn 생성
        return create_interaction_turn(self.db, self.journal_entry_id, stage) 