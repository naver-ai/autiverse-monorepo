from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.database.crud.chatbot import (
    get_journal, update_journal_data, create_interaction_turn, 
    create_message, get_messages_by_journal_entry_and_stage
)
from backend.database.models import JournalEntryStage, MessageRole, Message, MessageIntent
from .title_generator import TitleGenerator
import re
from sqlmodel.ext.asyncio.session import AsyncSession

class TitleStage:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.title_generator = TitleGenerator()
        print(f"[DEBUG] title_stage: TitleStage initialized for journal_entry_id={journal_entry_id}")
    
    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'TitleStage':
        """비동기 팩토리 메서드"""
        instance = cls(db, journal_entry_id)
        return instance
        
    async def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name or "친구"
        return "친구"
    
    async def start_title_selection(self) -> Message:
        """제목 선택 시작 - Structured Output 사용"""
        try:
            # Journal entry stage 업데이트
            from backend.database.crud.chatbot import update_journal_entry_stage
            await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Title)
            
            # 새로운 interaction turn 생성
            interaction_turn = await create_interaction_turn(
                self.db, self.journal_entry_id, JournalEntryStage.Title
            )
            
            # 만화 데이터 가져오기
            journal = await get_journal(self.db, self.journal_entry_id)
            if not journal:
                return "만화 데이터를 찾을 수 없어요."
            
            # 최종 만화 데이터 선택 (revision_2 우선, 없으면 comic_context)
            comic_data = journal.revision_2 if journal.revision_2 else journal.comic_context
            if not comic_data:
                return "만화 데이터를 찾을 수 없어요."
            
            # AI 제목 3개 생성
            child_name = await self._get_child_name()
            generated_titles = await self.title_generator.generate_title(comic_data, child_name)

            # 첫 번째 질문 생성 (제목 3개 제시)
            initial_question = f"우리 오늘 일기의 제목은 뭐로 할까? 1) {generated_titles['title1']} 2) {generated_titles['title2']} 3) {generated_titles['title3']} 어떤 제목이 마음에 들어?"
            
            new_message = await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                initial_question, MessageRole.Assistant, JournalEntryStage.Title, 
                metadata_json={"titles": generated_titles},
                intent=MessageIntent.InitialTitleConfirm
            )
            
            return new_message
            
        except Exception as e:
            print(f"[DEBUG] title_stage: Error in start_title_selection: {e}")
            raise
    
    async def process_message(self, user_message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Message | None:
        """사용자 메시지 처리"""
        
        try:
            # 현재 interaction turn 가져오기
            interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.Title)
            
            # 사용자 메시지 저장
            await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                user_message, MessageRole.User, JournalEntryStage.Title,
                audio_filename=audio_filename,
                intent=intent
            )
            
            child_name = await self._get_child_name()
            
            # 이전 메시지들을 확인하여 현재 상황 판단
            messages = await get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.Title)
            
            # 마지막 Assistant 메시지 확인 (빈 메시지 제외)
            last_assistant_message: Message | None = None
            for message in reversed(messages):
                if message.role == MessageRole.Assistant and message.content.strip():
                    last_assistant_message = message
                    break
            
            if not last_assistant_message:
                return None
            
            metadata = None

            # 마지막 메시지에 따라 처리
            if last_assistant_message.intent == MessageIntent.InitialTitleConfirm:
                # 제목 3개 중에서 선택
                response, response_intent = await self._process_title_selection(user_message, last_assistant_message, child_name)
                
            elif last_assistant_message.intent == MessageIntent.CustomTitleConfirm:
                # 커스텀 제목 확인에 대한 피드백
                # 마지막 메시지에서 제목 추출 (따옴표 안의 내용)
                custom_title = last_assistant_message.metadata_json.get("title", "")

                # 전체 메시지 히스토리에서 '아니, 다른 걸로' 버튼을 클릭한 횟수 계산 (새로운 제목이 나와도 유지)
                reject_count = 0
                for message in messages:
                    if message.role == MessageRole.User and message.content == "아니, 다른 걸로":
                        reject_count += 1
                
                response, response_intent = self.title_generator.process_custom_title_feedback(user_message, custom_title, child_name, reject_count)
                
            elif ("그럼 어떤 제목으로 하고 싶어?" in last_assistant_message.content) or ("채팅으로 쳐서 정확하게 알려줘!" in last_assistant_message.content):
                # 커스텀 제목 입력
                await self._save_title(user_message.strip())
                response, response_intent, metadata = self.title_generator.confirm_custom_title(user_message.strip(), child_name)
            else:
                # 기본 응답 (예상치 못한 상황)
                response = ""
                response_intent = None

            # 봇 응답 저장
            message = await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                response, MessageRole.Assistant, JournalEntryStage.Title,
                metadata_json=metadata,
                intent=response_intent
            )
            
            return message
            
        except Exception as e:
            print(f"[DEBUG] title_stage: Error in process_message: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    async def _save_title(self, title: str) -> None:
        """단일 제목을 데이터베이스에 저장"""
        try:
            result = await update_journal_data(self.db, self.journal_entry_id, title=title)
        except Exception as e:
            print(f"[DEBUG] title_stage: Error saving title: {e}")
    
    async def _process_title_selection(self, user_message: str, last_assistant_message: Message, child_name: str) -> tuple[str, MessageIntent]:
        """제목 3개 중에서 사용자 선택 처리"""
        # 메타데이터에서 제목들 가져오기
        titles = last_assistant_message.metadata_json.get("titles", {})
        
        # 1, 2, 3 선택 시 해당 제목을 DB에 저장
        selected_title = ""
        if user_message in ["1"]:
            selected_title = titles.get("title1", "")
            await self._save_title(selected_title)
        elif user_message in ["2"]:
            selected_title = titles.get("title2", "")
            await self._save_title(selected_title)
        elif user_message in ["3"]:
            selected_title = titles.get("title3", "")
            await self._save_title(selected_title)
        
        # title_generator의 process_title_feedback 사용
        response, response_intent = self.title_generator.process_title_feedback(user_message, selected_title, child_name)
        
        return response, response_intent
    
    async def _get_or_create_interaction_turn(self, stage: JournalEntryStage):
        """현재 interaction turn 가져오기 또는 생성"""
        from backend.database.crud.chatbot import get_latest_interaction_turn, create_interaction_turn
        
        # 현재 stage의 interaction turn 찾기
        latest_turn = await get_latest_interaction_turn(self.db, self.journal_entry_id)
        
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        
        # 새로운 interaction turn 생성
        return await create_interaction_turn(self.db, self.journal_entry_id, stage) 