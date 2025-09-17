from typing import Dict, Any, Optional, List
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.database.crud.chatbot import (
    get_dyad_by_passcode, get_dyad_by_id, create_journal_entry, get_journal_entry, 
    create_journal, get_journal, update_journal_data, update_journal_entry_stage,
    get_messages_by_journal_entry, delete_journal_entry, reset_journal_entry
)
from backend.database.models import JournalEntryStage, JournalEntryStatus, MessageRole, JournalingSessionInfo, ChatMessage, ComicData, MessageIntent
from backend.core.ai.pipelines import ComicIntroStage, Revision1Stage, ComicContextStage, Revision2Stage, TitleStage

class ChatbotController:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.title_stage = None  # TitleStage 인스턴스 저장
        self.current_journal_entry_id: Optional[str] = None
        self.comic_context_count: int = -1  # comic_context 대화 카운터
        
    async def start_chatbot(self, dyad_id: str, location: str = None, people: List[str] = None) -> Dict[str, Any]:
        """챗봇 시작"""
        # dyad_id로 dyad 조회
        dyad = await get_dyad_by_id(self.db, dyad_id)
        if not dyad:
            raise ValueError("Invalid dyad_id")
        
        # 새로운 journal entry 생성
        journal_entry = await create_journal_entry(self.db, dyad_id)
        self.current_journal_entry_id = journal_entry.id
        
        # journal 생성
        journal = await create_journal(self.db, journal_entry.id, dyad_id, location, people)
        
        # Comic 테이블 생성 (comic generation을 위해 필요)
        from backend.database.crud.chatbot import create_comic
        await create_comic(self.db, journal_entry.id, journal.id, dyad_id)
        
        # comic intro 단계 시작
        intro_stage = await ComicIntroStage.create(self.db, journal_entry.id)
        initial_message = await intro_stage.start_conversation(location, people)
        
        return {
            "journal_entry_id": journal_entry.id,
            "message_id": initial_message.id,
            "response": initial_message.content,
            "intent": initial_message.intent,
            "stage": "intro"
        }
    
    async def start_chatbot_with_suggestion(self, dyad_id: str) -> Dict[str, Any]:
        """챗봇 시작 (뭘 쓸지 모르겠네 버튼용)"""
        # dyad_id로 dyad 조회
        dyad = await get_dyad_by_id(self.db, dyad_id)
        if not dyad:
            raise ValueError("Invalid dyad_id")
        
        # 새로운 journal entry 생성
        journal_entry = await create_journal_entry(self.db, dyad_id)
        self.current_journal_entry_id = journal_entry.id
        
        # journal 생성 (location과 people은 DB에서 가져올 예정)
        journal = await create_journal(self.db, journal_entry.id, dyad_id, None, None)
        
        # Comic 테이블 생성 (comic generation을 위해 필요)
        from ...database.crud.chatbot import create_comic
        await create_comic(self.db, journal_entry.id, journal.id, dyad_id)
        
        # comic intro 단계 시작 (suggestion 모드)
        intro_stage = await ComicIntroStage.create(self.db, journal_entry.id)
        initial_message = await intro_stage.start_conversation_with_suggestion()
        
        return {
            "journal_entry_id": journal_entry.id,
            "message_id": initial_message.id,
            "response": initial_message.content,
            "intent": initial_message.intent,
            "stage": "intro"
        }
    
    async def send_message(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """메시지 전송"""
        # journal entry 조회
        journal_entry = await get_journal_entry(self.db, journal_entry_id)
        if not journal_entry:
            raise ValueError("Journal entry not found")
        
        # 현재 단계에 따라 적절한 핸들러 호출
        current_stage = journal_entry.stage
        
        if current_stage == JournalEntryStage.Intro:
            return await self._handle_intro_stage(journal_entry_id, message, intent, audio_filename)
        elif current_stage == JournalEntryStage.Revision1 or current_stage == JournalEntryStage.ComicContext or current_stage == JournalEntryStage.Revision2:
            return await self._handle_drawing_stage(journal_entry_id, message, intent, audio_filename)
        elif current_stage == JournalEntryStage.Title:
            return await self._handle_title_stage(journal_entry_id, message, intent, audio_filename)
        elif current_stage == JournalEntryStage.Complete:
            return await self._handle_complete_stage(journal_entry_id, message, intent, audio_filename)
        else:
            raise ValueError(f"Unknown stage: {current_stage}")
    
    async def _handle_intro_stage(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """인트로 단계 처리 - 완전히 하드코딩으로 revision_1 처리"""
        # 고정된 comic panels를 comic_intro에 저장
        fixed_comic_panels = {
            "panel1": "I played with Oliver at school today.",
            "panel2": None,
            "panel3": "Oliver was in a bad mood.",
            "panel4": None
        }
        
        # Journal entry stage를 Revision1으로 업데이트
        await update_journal_entry_stage(self.db, journal_entry_id, JournalEntryStage.Revision1)
        
        await update_journal_data(
            self.db, journal_entry_id,
            events=["I played with Oliver at school today.", "Oliver was in a bad mood."],
            summary="I played with Oliver at school today. Oliver was in a bad mood.",
            comic_intro=fixed_comic_panels
        )
        
        # Message를 DB에 저장
        from ...database.crud.chatbot import create_interaction_turn, create_message
        interaction_turn = await create_interaction_turn(
            self.db, journal_entry_id, JournalEntryStage.Revision1
        )
        
        message = await create_message(
            self.db, journal_entry_id, interaction_turn.id,
            "I see! Then let's try writing today's journal entry using what you just told me. Is anything incorrect here? 🤔",
            MessageRole.Assistant, JournalEntryStage.Revision1,
            intent=MessageIntent.PromptIssueExist
        )
        
        # 하드코딩된 응답으로 바로 반환 (LLM 호출 없이)
        return {
            "message_id": message.id,
            "response": "I see! Then let's try writing today's journal entry using what you just told me. Is anything incorrect here? 🤔",
            "stage": "revision_1",
            "intent": "prompt_issue_exist",
            "data": {
                "events": ["I played with Oliver at school today.", "Oliver was in a bad mood."],
                "summary": "I played with Oliver at school today. Oliver was in a bad mood.",
                "panels": fixed_comic_panels
            }
        }
    
    async def _handle_drawing_stage(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """그리기 단계 처리 - 하드코딩으로 처리"""
        journal_entry = await get_journal_entry(self.db, journal_entry_id)
        journal = await get_journal(self.db, journal_entry_id)
        
        if not journal:
            return {"response": "Journal not found", "stage": "error"}
        
        # 현재 단계에 따라 적절한 핸들러 호출
        current_stage = journal_entry.stage
        
        if current_stage == JournalEntryStage.Revision1:
            # revision_1에서 "All correct"를 누른 경우 comic_context로 넘어가기
            if intent == MessageIntent.StartComicGeneration:
                return await self._handle_comic_context_stage(journal_entry_id, message, intent, audio_filename)
            else:
                # revision_1 단계 처리 (기존 로직 사용)
                return await self._handle_revision_1_stage(journal_entry_id, message, intent, audio_filename)
        elif current_stage == JournalEntryStage.ComicContext:
            return await self._handle_comic_context_stage(journal_entry_id, message, intent, audio_filename)
        elif current_stage == JournalEntryStage.Revision2:
            return await self._handle_revision_2_stage(journal_entry_id, message, intent, audio_filename)
    
    async def _handle_revision_1_stage(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """revision_1 단계 처리"""
        revision_stage = await Revision1Stage.create(self.db, journal_entry_id)
        message = await revision_stage.process_message(message, intent, audio_filename)
        
        return {
            "message_id": message.id,
            "response": message.content,
            "intent": message.intent,
            "stage": "revision_1"  # comic generation이 시작되어도 revision_1로 유지
        }
    
    async def _handle_comic_context_stage(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """comic_context 단계 처리 - comic generation 후 하드코딩된 대화 시작"""
        from .pipelines.comic_context_stage import ComicContextStage
        stage = await ComicContextStage.create(self.db, journal_entry_id)
        
        # 첫 번째 호출인지 확인 (comic generation이 필요한지)
        journal = await get_journal(self.db, journal_entry_id)
        if not journal.comic_context:
            # 첫 번째 호출: comic generation 수행 후 start_context_analysis
            from .pipelines.revision_1_stage import Revision1Stage
            revision1_stage = await Revision1Stage.create(self.db, journal_entry_id)
            await revision1_stage._generate_comic_panels()
            
            message_obj = await stage.start_context_analysis()
            
            return {
                "message_id": message_obj.id,
                "response": message_obj.content,
                "intent": message_obj.intent,
                "stage": "comic_context",
                "metadata": message_obj.metadata_json
            }
        else:
            # 이후 호출: comic_context_stage의 process_message 사용
            print(f"[DEBUG] chatbot_controller: Calling comic_context_stage.process_message with user_message='{message}', intent={intent}")
            message_obj = await stage.process_message(message, intent, audio_filename)
            
            return {
                "message_id": message_obj.id,
                "response": message_obj.content,
                "intent": message_obj.intent,
                "stage": "comic_context",
                "metadata": message_obj.metadata_json
            }
    
    async def _handle_revision_2_stage(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """revision_2 단계 처리"""
        print(f"[DEBUG] _handle_revision_2_stage: message={message.strip()}, intent={intent}")
        if intent == MessageIntent.AnswerNext:
            # 사용자 메시지를 DB에 저장
            revision2_stage = await Revision2Stage.create(self.db, journal_entry_id)
            interaction_turn = await revision2_stage._get_or_create_interaction_turn(JournalEntryStage.Revision2)
            
            from backend.database.crud.chatbot import create_message
            
            await create_message(
                self.db, journal_entry_id, interaction_turn.id,
                message, MessageRole.User, JournalEntryStage.Revision2,
                audio_filename=audio_filename,
                intent=intent
            )
            
            # title stage 시작
            self.title_stage = await TitleStage.create(self.db, journal_entry_id)
            title_response_message = await self.title_stage.start_title_selection()
            
            return {
                "message_id": title_response_message.id,
                "response": title_response_message.content,
                "intent": title_response_message.intent,
                "metadata": title_response_message.metadata_json,
                "stage": "title"
            }
        
        revision2_stage = await Revision2Stage.create(self.db, journal_entry_id)
        response_message = await revision2_stage.process_message(message, intent, audio_filename)
        
        return {
            "message_id": response_message.id,
            "response": response_message.content,
            "intent": response_message.intent,
            "stage": "revision_2"
        }
    

    
    async def _handle_title_stage(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """title 단계 처리 (제목 정하기)"""
        if not self.title_stage:
            # TitleStage 인스턴스가 없으면 새로 생성
            self.title_stage = await TitleStage.create(self.db, journal_entry_id)
        
        title_response_message = await self.title_stage.process_message(message, intent, audio_filename)
        
        # 제목 선택 완료 감지
        if intent == MessageIntent.AnswerNext:
            # complete stage로 전환
            from ...database.crud.chatbot import update_journal_entry_stage
            await update_journal_entry_stage(self.db, journal_entry_id, JournalEntryStage.Complete)
            
            return {
                "message_id": title_response_message.id,
                "response": title_response_message.content,
                "intent": title_response_message.intent,
                "metadata": title_response_message.metadata_json,
                "stage": "complete",
                "title_completed": True
            }
        
        return {
            "message_id": title_response_message.id,
            "response": title_response_message.content,
            "intent": title_response_message.intent,
            "metadata": title_response_message.metadata_json,
            "stage": "title"
        }
    
    async def _handle_complete_stage(self, journal_entry_id: str, message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Dict[str, Any]:
        """complete 단계 처리 (최종 완료)"""
        return {
            "response": "만화가 완성되었습니다!",
            "stage": "complete"
        }
    
    async def get_session_info(self, journal_entry_id: str) -> JournalingSessionInfo:
        """세션 정보 조회"""
        journal_entry = await get_journal_entry(self.db, journal_entry_id)
        if not journal_entry:
            raise ValueError("Journal entry not found")
        
        journal = await get_journal(self.db, journal_entry_id)
        messages = await get_messages_by_journal_entry(self.db, journal_entry_id)
        
        # Comic 테이블에서 comic 데이터 조회
        from ...database.crud.chatbot import get_comic
        comic = await get_comic(self.db, journal_entry_id)
        
        # 현재 패널 데이터 결정
        current_panels = {}
        if journal:
            # 현재 단계에 따라 적절한 패널 데이터 선택
            if journal_entry.stage == JournalEntryStage.Complete:
                # complete 단계에서는 하드코딩된 패널 데이터 사용
                current_panels = {
                    "panel1": {
                        "content": "I played with Oliver at school today using an eraser.",
                        "place": "School",
                        "grid": [
                            {"type": "figure", "content": "Me", "position": [1, 2]},
                            {"type": "object", "content": "eraser", "position": [2, 2]},
                            {"type": "figure", "content": "Oliver", "position": [3, 2]}
                        ]
                    },
                    "panel2": {
                        "content": "I threw his eraser without asking for playing.",
                        "place": "",
                        "grid": [
                            {"type": "figure", "content": "Me", "position": [2, 2]},
                            {"type": "object", "content": "eraser", "position": [2, 3]}
                        ]
                    },
                    "panel3": {
                        "content": "I apologized to him after he got angry and told the teacher.",
                        "place": "",
                        "grid": [
                            {"type": "figure", "content": "Oliver", "position": [1, 2], "action": [{"type": "emotion", "content": "Angry"}, {"type": "tell", "content": "Ethan threw my eraser without asking"}]},
                            {"type": "figure", "content": "Teacher", "position": [3, 2]}
                        ]
                    },
                    "panel4": {
                        "content": "I was sad and scared.",
                        "place": "",
                        "grid": [
                            {"type": "figure", "content": "Me", "position": [2, 2], "action": [{"type": "emotion", "content": "Sad"}, {"type": "emotion", "content": "Scared"}]}
                        ]
                    }
                }
                print(f"[DEBUG] get_session_info: Using hardcoded complete data: {current_panels}")
            elif journal_entry.stage == JournalEntryStage.Title:
                # title 단계에서는 하드코딩된 패널 데이터 사용
                current_panels = {
                    "panel1": {
                        "content": "I played with Oliver at school today using an eraser.",
                        "place": "School",
                        "grid": [
                            {"type": "figure", "content": "Me", "position": [1, 2]},
                            {"type": "object", "content": "eraser", "position": [2, 2]},
                            {"type": "figure", "content": "Oliver", "position": [3, 2]}
                        ]
                    },
                    "panel2": {
                        "content": "I threw his eraser without asking for playing.",
                        "place": "",
                        "grid": [
                            {"type": "figure", "content": "Me", "position": [2, 2]},
                            {"type": "object", "content": "eraser", "position": [2, 3]}
                        ]
                    },
                    "panel3": {
                        "content": "I apologized to him after he got angry and told the teacher.",
                        "place": "",
                        "grid": [
                            {"type": "figure", "content": "Oliver", "position": [1, 2], "action": [{"type": "emotion", "content": "Angry"}, {"type": "tell", "content": "Ethan threw my eraser without asking"}]},
                            {"type": "figure", "content": "Teacher", "position": [3, 2]}
                        ]
                    },
                    "panel4": {
                        "content": "I was sad and scared.",
                        "place": "",
                        "grid": [
                            {"type": "figure", "content": "Me", "position": [2, 2], "action": [{"type": "emotion", "content": "Sad"}, {"type": "emotion", "content": "Scared"}]}
                        ]
                    }
                }
                print(f"[DEBUG] get_session_info: Using hardcoded title data: {current_panels}")
            elif journal_entry.stage == JournalEntryStage.Revision2:
                # revision_2 단계에서는 실제 revision_2 데이터 사용 (업데이트된 내용 반영)
                if journal and journal.revision_2:
                    current_panels = journal.revision_2
                    print(f"[DEBUG] get_session_info: Using revision_2 data: {current_panels}")
                else:
                    # fallback: 하드코딩된 패널 데이터 사용
                    current_panels = {
                        "panel1": {
                            "content": "I played with Oliver at school today using an eraser.",
                            "place": "School",
                            "grid": [
                                {"type": "figure", "content": "Me", "position": [1, 2]},
                                {"type": "object", "content": "eraser", "position": [2, 2]},
                                {"type": "figure", "content": "Oliver", "position": [3, 2]}
                            ]
                        },
                        "panel2": {
                            "content": "I threw his eraser without asking for playing.",
                            "place": "",
                            "grid": [
                                {"type": "figure", "content": "Me", "position": [2, 2]},
                                {"type": "object", "content": "eraser", "position": [2, 3]}
                            ]
                        },
                        "panel3": {
                            "content": "Oliver got angry and told the teacher.",
                            "place": "",
                            "grid": [
                                {"type": "figure", "content": "Oliver", "position": [1, 2], "action": [{"type": "emotion", "content": "Angry"}, {"type": "tell", "content": "Ethan threw my eraser without asking"}]},
                                {"type": "figure", "content": "Teacher", "position": [3, 2]}
                            ]
                        },
                        "panel4": {
                            "content": "I was sad and scared.",
                            "place": "",
                            "grid": [
                                {"type": "figure", "content": "Me", "position": [2, 2], "action": [{"type": "emotion", "content": "Sad"}, {"type": "emotion", "content": "Scared"}]}
                            ]
                        }
                    }
                    print(f"[DEBUG] get_session_info: Using fallback hardcoded revision2 data: {current_panels}")
            elif journal_entry.stage == JournalEntryStage.ComicContext and journal.comic_context:
                current_panels = journal.comic_context
                print(f"[DEBUG] get_session_info: Using comic_context data: {current_panels}")
                
                # comic_context 단계에서는 모든 panel_updates를 누적해서 적용
                if messages:
                    # 기본 comic panels 설정
                    fixed_comic_panels = {
                        "panel1": {
                            "content": "I played with Oliver at school today.",
                            "place": "School",
                            "grid": [
                                {"type": "figure", "content": "Me", "position": [1, 2]},
                                {"type": "figure", "content": "Oliver", "position": [2, 2]}
                            ]
                        },
                        "panel2": {
                            "content": "",
                            "place": "",
                            "grid": []
                        },
                        "panel3": {
                            "content": "Oliver was in a bad mood.",
                            "place": "",
                            "grid": [
                                {"type": "figure", "content": "Oliver", "position": [2, 2], "action": [{"type": "emotion", "content": "bad mood"}]}
                            ]
                        },
                        "panel4": {
                            "content": "",
                            "place": "",
                            "grid": []
                        }
                    }
                    
                    # 현재 DB에 있는 데이터가 있으면 그것을 기본값으로 사용
                    if current_panels:
                        for panel_key in ["panel1", "panel2", "panel3", "panel4"]:
                            if panel_key in current_panels:
                                fixed_comic_panels[panel_key] = current_panels[panel_key]
                    
                    # 모든 Assistant 메시지의 panel_updates를 순서대로 적용 (누적)
                    for msg in messages:
                        if msg.role == MessageRole.Assistant and msg.metadata_json:
                            panel_updates = msg.metadata_json.get("panel_updates")
                            if panel_updates:
                                print(f"[DEBUG] get_session_info: Applying panel_updates from message {msg.id}: {panel_updates}")
                                for panel_key, new_content in panel_updates.items():
                                    if panel_key in fixed_comic_panels:
                                        print(f"[DEBUG] get_session_info: Before update - {panel_key}: {fixed_comic_panels[panel_key]['content']}")
                                        fixed_comic_panels[panel_key]["content"] = new_content
                                        print(f"[DEBUG] get_session_info: After update - {panel_key}: {fixed_comic_panels[panel_key]['content']}")
                    
                    current_panels = fixed_comic_panels
                    print(f"[DEBUG] get_session_info: Final current_panels after all panel_updates: {current_panels}")
            elif journal.revision_1:
                # revision_1이 있으면 우선 사용
                current_panels = journal.revision_1
            elif journal.comic_intro:
                # comic_intro 데이터가 있으면 사용
                current_panels = journal.comic_intro
        
        # Comic 테이블의 grid 데이터와 Journal 테이블의 텍스트 데이터를 결합
        # comic_context, revision2, title, complete 단계에서는 Comic 테이블 데이터를 사용하지 않고 Journal의 데이터만 사용
        if comic and current_panels and journal_entry.stage != JournalEntryStage.ComicContext and journal_entry.stage != JournalEntryStage.Revision2 and journal_entry.stage != JournalEntryStage.Title and journal_entry.stage != JournalEntryStage.Complete:
            # 각 패널에 대해 Comic 테이블의 grid 데이터 추가
            for i in range(1, 5):
                panel_key = f"panel{i}"
                if panel_key in current_panels:
                    # 현재 단계에 따라 적절한 comic 데이터 선택
                    if journal_entry.stage == JournalEntryStage.Complete or journal_entry.stage == JournalEntryStage.Title or journal_entry.stage == JournalEntryStage.Revision2:
                        # 완료 단계, 제목 단계, revision_2에서는 second_panel 사용
                        comic_panel = getattr(comic, f"second_panel{i}", None)
                    else:
                        # 그 외 단계에서는 first_panel 사용
                        comic_panel = getattr(comic, f"first_panel{i}", None)
                    
                    if comic_panel:
                        # 기존 텍스트 데이터에 grid 데이터와 place 데이터 추가
                        if isinstance(current_panels[panel_key], dict):
                            current_panels[panel_key]["grid"] = comic_panel.get("grid", [])
                            current_panels[panel_key]["place"] = comic_panel.get("place", "")
                        else:
                            # 문자열인 경우 dict로 변환
                            current_panels[panel_key] = {
                                "content": current_panels[panel_key],
                                "place": comic_panel.get("place", ""),
                                "grid": comic_panel.get("grid", [])
                            }
        
        # 백엔드에서 내려주는 focusedPanel 사용
        focused_panel = None
        if journal_entry.stage == JournalEntryStage.ComicContext and messages:
            # 가장 최근 Assistant 메시지의 metadata에서 focus panel 정보 가져오기
            for msg in reversed(messages):
                print(f"[DEBUG] get_session_info: Checking message {msg.id}, role={msg.role}, metadata_json={msg.metadata_json}")
                if msg.role == MessageRole.Assistant and msg.metadata_json:
                    focused_panel = msg.metadata_json.get("focused_panel")
                    print(f"[DEBUG] get_session_info: Found focused_panel={focused_panel} in message {msg.id}")
                    if focused_panel:
                        break
        
        print(f"[DEBUG] get_session_info: stage={journal_entry.stage}, focused_panel={focused_panel}")
        
        # 메시지를 프론트엔드에서 사용할 수 있는 형태로 변환
        formatted_messages = []
        if messages:
            for msg in messages:
                formatted_messages.append(ChatMessage(
                    id=msg.id,
                    text=msg.content,
                    isUser=msg.role == MessageRole.User,
                    timestamp=msg.created_at.isoformat() if msg.created_at else None,
                    intent=msg.intent,
                    metadata=msg.metadata_json
                ))
        
        # Convert current_panels to ComicData if it exists
        comic_data = None
        if current_panels:
            print(f"[DEBUG] get_session_info: current_panels: {current_panels}")
            # Filter out None values and panels with None content
            filtered_panels = {}
            for key in ["panel1", "panel2", "panel3", "panel4"]:
                panel_data = current_panels.get(key)
                if panel_data is not None:
                    # Check if it's a dict with None content
                    if isinstance(panel_data, dict) and panel_data.get("content") is None:
                        continue
                    # Check if it's a string (which is valid)
                    elif isinstance(panel_data, str):
                        filtered_panels[key] = panel_data
                    # Check if it's a dict with valid content
                    elif isinstance(panel_data, dict) and panel_data.get("content") is not None:
                        filtered_panels[key] = panel_data
            
            print(f"[DEBUG] get_session_info: filtered_panels: {filtered_panels}")
            # Only create ComicData if we have at least one panel
            if filtered_panels:
                comic_data = ComicData(**filtered_panels)
                print(f"[DEBUG] get_session_info: comic_data created: {comic_data}")
        
        return JournalingSessionInfo(
                journal_entry_id=journal_entry_id,
                stage=journal_entry.stage.value if journal_entry.stage else "intro",
                status=journal_entry.status.value if journal_entry.status else "initial",
                location=journal.location if journal else None,
                people=journal.people if journal else None,
                events=journal.events if journal else None,
                summary=journal.summary if journal else None,
                title=journal.title if journal else None,
                panels=comic_data,
                message_count=len(messages) if messages else 0,
                focusedPanel=focused_panel,
                messages=formatted_messages
            )
    
    async def reset_session(self, journal_entry_id: str) -> Dict[str, Any]:
        """세션 초기화"""
        await reset_journal_entry(self.db, journal_entry_id)
        
        return {
            "response": "세션이 초기화되었습니다.",
            "stage": "intro"
        }
    
    async def delete_session(self, journal_entry_id: str) -> bool:
        """세션 삭제"""
        return await delete_journal_entry(self.db, journal_entry_id)
    
    async def _wait_for_comic_generation(self, journal_entry_id: str, stage_name: str) -> None:
        """만화 생성이 완료될 때까지 대기"""
        import asyncio
        from backend.database.crud.chatbot import get_comic_status
        
        max_wait_time = 30  # 최대 30초 대기 (단축)
        wait_interval = 0.3  # 0.3초마다 확인 (더 빠른 체크)
        
        for _ in range(int(max_wait_time / wait_interval)):
            try:
                # DB에서 직접 만화 생성 상태 확인
                status = await get_comic_status(self.db, journal_entry_id)
                
                if status == 'completed':
                    print(f"[DEBUG] {stage_name}: Comic generation completed for {journal_entry_id}")
                    break
                elif status == 'error':
                    print(f"[DEBUG] {stage_name}: Comic generation failed for {journal_entry_id}")
                    break
                
                await asyncio.sleep(wait_interval)
            except Exception as e:
                print(f"[DEBUG] {stage_name}: Error checking comic generation status: {e}")
                await asyncio.sleep(wait_interval) 