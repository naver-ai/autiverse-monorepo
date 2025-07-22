from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from backend.database.crud.chatbot import (
    get_dyad_by_passcode, get_dyad_by_id, create_journal_entry, get_journal_entry, 
    create_journal, get_journal, update_journal_data, 
    get_messages_by_journal_entry, delete_journal_entry, reset_journal_entry
)
from backend.database.models import JournalEntryStage, JournalEntryStatus, MessageRole, JournalingSessionInfo, ChatMessage, ComicData
from backend.core.ai.pipelines import ComicIntroStage, Revision1Stage, ComicContextStage, Revision2Stage, TitleStage

class ChatbotController:
    def __init__(self, db: Session):
        self.db = db
        self.title_stage = None  # TitleStage 인스턴스 저장
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
        from backend.database.crud.chatbot import create_comic
        create_comic(self.db, journal_entry.id, journal.id, dyad_id)
        
        # comic intro 단계 시작
        intro_stage = ComicIntroStage(self.db, journal_entry.id)
        initial_message = intro_stage.start_conversation(location, people)
        
        return {
            "journal_entry_id": journal_entry.id,
            "response": initial_message,
            "stage": "intro"
        }
    
    def start_chatbot_with_suggestion(self, dyad_id: str) -> Dict[str, Any]:
        """챗봇 시작 (뭘 쓸지 모르겠네 버튼용)"""
        # dyad_id로 dyad 조회
        dyad = get_dyad_by_id(self.db, dyad_id)
        if not dyad:
            raise ValueError("Invalid dyad_id")
        
        # 새로운 journal entry 생성
        journal_entry = create_journal_entry(self.db, dyad_id)
        self.current_journal_entry_id = journal_entry.id
        
        # journal 생성 (location과 people은 DB에서 가져올 예정)
        journal = create_journal(self.db, journal_entry.id, dyad_id, None, None)
        
        # Comic 테이블 생성 (comic generation을 위해 필요)
        from ...database.crud.chatbot import create_comic
        create_comic(self.db, journal_entry.id, journal.id, dyad_id)
        
        # comic intro 단계 시작 (suggestion 모드)
        intro_stage = ComicIntroStage(self.db, journal_entry.id)
        initial_message = intro_stage.start_conversation_with_suggestion()
        
        return {
            "journal_entry_id": journal_entry.id,
            "response": initial_message,
            "stage": "intro"
        }
    
    def send_message(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """메시지 전송"""
        # journal entry 조회
        journal_entry = get_journal_entry(self.db, journal_entry_id)
        if not journal_entry:
            raise ValueError("Journal entry not found")
        
        # 현재 단계에 따라 적절한 핸들러 호출
        current_stage = journal_entry.stage
        
        if current_stage == JournalEntryStage.Intro:
            return self._handle_intro_stage(journal_entry_id, message, audio_filename)
        elif current_stage == JournalEntryStage.Revision1 or current_stage == JournalEntryStage.ComicContext or current_stage == JournalEntryStage.Revision2:
            return self._handle_drawing_stage(journal_entry_id, message, audio_filename)
        elif current_stage == JournalEntryStage.Title:
            return self._handle_title_stage(journal_entry_id, message, audio_filename)
        elif current_stage == JournalEntryStage.Complete:
            return self._handle_complete_stage(journal_entry_id, message, audio_filename)
        else:
            raise ValueError(f"Unknown stage: {current_stage}")
    
    def _handle_intro_stage(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """인트로 단계 처리"""
        intro_stage = ComicIntroStage(self.db, journal_entry_id)
        
        # 메시지 처리 (audio_filename 포함)
        response = intro_stage.process_message(message, audio_filename)
        
        # 이벤트 분석
        analysis = intro_stage.analyze_events()
        
        # 다음 단계로 진행할 준비가 되었는지 확인
        if intro_stage.is_ready_for_next_stage():
            # 마지막 assistant 메시지 삭제 (UI에 표시되지 않는 메시지)
            from ...database.crud.chatbot import get_messages_by_journal_entry, delete_message
            messages = get_messages_by_journal_entry(self.db, journal_entry_id)
            if messages and messages[-1].role == MessageRole.Assistant:
                delete_message(self.db, messages[-1].id)
            
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
    
    def _handle_drawing_stage(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """그리기 단계 처리 (revision_1, comic_context, revision_2)"""
        journal_entry = get_journal_entry(self.db, journal_entry_id)
        journal = get_journal(self.db, journal_entry_id)
        
        if not journal:
            return {"response": "Journal not found", "stage": "error"}
        
        # 현재 단계에 따라 적절한 핸들러 호출
        current_stage = journal_entry.stage
        
        if current_stage == JournalEntryStage.Revision1:
            return self._handle_revision_1_stage(journal_entry_id, message, audio_filename)
        elif current_stage == JournalEntryStage.ComicContext:
            return self._handle_comic_context_stage(journal_entry_id, message, audio_filename)
        elif current_stage == JournalEntryStage.Revision2:
            return self._handle_revision_2_stage(journal_entry_id, message, audio_filename)
        else:
            # 완료
            return {
                "response": "대화가 완료되었습니다.",
                "stage": "complete"
            }
    
    def _handle_revision_1_stage(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """revision_1 단계 처리"""
        revision_stage = Revision1Stage(self.db, journal_entry_id)
        response = revision_stage.process_message(message, audio_filename)
        
        # 만화 생성 시작 신호인지 확인
        if response == "COMIC_GENERATION_START":
            # 만화 생성 시작 (프론트엔드에서 모니터링할 수 있도록)
            revision_stage._generate_comic_panels()
            
            # 만화 생성 시작 메시지 반환
            return {
                "response": "다행이다:) 그럼 네가 확인해준 내용을 내가 그림으로 그려볼게! 잠깐만 기다려줘~",
                "stage": "revision_1",
                "auto_comic_generation": True
            }
        
        # 만화 생성 완료 신호인지 확인

        # 완료되었는지 확인
        if "다행이다" in response:
            return {
                "response": response,
                "stage": "comic_context"
            }
        
        return {
            "response": response,
            "stage": "revision_1"
        }
    
    def _handle_comic_context_stage(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """comic_context 단계 처리"""
        context_stage = ComicContextStage(self.db, journal_entry_id)
        response = context_stage.process_message(message, audio_filename)
        
        # 만화 생성 시작 신호인 경우
        if response == "COMIC_GENERATION_START":
            context_stage._generate_final_comic_panels()
            
            # 만화 생성 시작 메시지 반환
            return {
                "response": "내가 물어보는 질문에 잘 답해줘서 고마워. 네 덕분에 비어있던 부분을 채울 수 있을 것 같아! 조금만 기다려줘~",
                "stage": "comic_context",
                "auto_comic_generation": True
            }
        
        # focusedPanel 설정 로직 추가
        focused_panel = None
        if context_stage.story_analysis:
            # story_analysis에서 첫 번째로 누락된 정보가 있는 패널 찾기
            content_issues = context_stage.story_analysis.get("content", {})
            panels = ["A", "B", "C", "D"] # Assuming these are the panel keys
            panel_mapping = {"A": "panel1", "B": "panel2", "C": "panel3", "D": "panel4"}
            for panel in panels:
                if content_issues.get(panel) and content_issues[panel]:  # 해당 패널에 누락된 정보가 있으면
                    # A -> panel1, B -> panel2, C -> panel3                   panel_mapping = {"A": "panel1,B": "panel2,C": "panel3,                    focused_panel = panel_mapping[panel]
                    break
        
        return {
            "response": response,
            "stage": "comic_context",
            "focusedPanel": focused_panel
        }
    
    def _handle_revision_2_stage(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """revision_2 단계 처리"""
        print(f"[DEBUG] _handle_revision_2_stage: message={message.strip()}")
        if message.strip() == "좋아!" or message.strip() == "그러자!":
            # 사용자 메시지를 DB에 저장
            revision2_stage = Revision2Stage(self.db, journal_entry_id)
            interaction_turn = revision2_stage._get_or_create_interaction_turn(JournalEntryStage.Revision2)
            
            from backend.database.crud.chatbot import create_message
            
            create_message(
                self.db, journal_entry_id, interaction_turn.id,
                message, MessageRole.User, JournalEntryStage.Revision2,
                audio_filename=audio_filename
            )
            
            # title stage 시작
            self.title_stage = TitleStage(self.db, journal_entry_id)
            title_response = self.title_stage.start_title_selection()
            
            return {
                "response": title_response,
                "stage": "title"
            }
        
        revision2_stage = Revision2Stage(self.db, journal_entry_id)
        response = revision2_stage.process_message(message, audio_filename)
        
        return {
            "response": response,
            "stage": "revision_2"
        }
    

    
    def _handle_title_stage(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """title 단계 처리 (제목 정하기)"""
        if not self.title_stage:
            # TitleStage 인스턴스가 없으면 새로 생성
            self.title_stage = TitleStage(self.db, journal_entry_id)
        
        response = self.title_stage.process_message(message, audio_filename)
        
        # 제목 선택 완료 감지
        if message.strip() == "다음":
            # complete stage로 전환
            from ...database.crud.chatbot import update_journal_entry_stage
            update_journal_entry_stage(self.db, journal_entry_id, JournalEntryStage.Complete)
            
            return {
                "response": response,
                "stage": "complete",
                "title_completed": True
            }
        
        return {
            "response": response,
            "stage": "title"
        }
    
    def _handle_complete_stage(self, journal_entry_id: str, message: str, audio_filename: str = None) -> Dict[str, Any]:
        """complete 단계 처리 (최종 완료)"""
        return {
            "response": "만화가 완성되었습니다!",
            "stage": "complete"
        }
    
    def get_session_info(self, journal_entry_id: str) -> JournalingSessionInfo:
        """세션 정보 조회"""
        journal_entry = get_journal_entry(self.db, journal_entry_id)
        if not journal_entry:
            raise ValueError("Journal entry not found")
        
        journal = get_journal(self.db, journal_entry_id)
        messages = get_messages_by_journal_entry(self.db, journal_entry_id)
        
        # Comic 테이블에서 comic 데이터 조회
        from ...database.crud.chatbot import get_comic
        comic = get_comic(self.db, journal_entry_id)
        
        # 현재 패널 데이터 결정
        current_panels = {}
        if journal:
            # 현재 단계에 따라 적절한 패널 데이터 선택
            if journal_entry.stage == JournalEntryStage.Complete or journal_entry.stage == JournalEntryStage.Title:
                # 완료 단계와 제목 단계에서는 revision_2 우선, 없으면 comic_context 사용
                current_panels = journal.revision_2 if journal.revision_2 else journal.comic_context
            elif journal_entry.stage == JournalEntryStage.Revision2:
                # revision_2가 있으면 그것을 사용, 없으면 comic_context 사용
                current_panels = journal.revision_2 if journal.revision_2 else journal.comic_context
            elif journal_entry.stage == JournalEntryStage.ComicContext and journal.comic_context:
                current_panels = journal.comic_context
            elif journal.revision_1:
                # revision_1이 있으면 우선 사용
                current_panels = journal.revision_1
            elif journal.comic_intro:
                # comic_intro 데이터가 있으면 사용
                current_panels = journal.comic_intro
        
        # Comic 테이블의 grid 데이터와 Journal 테이블의 텍스트 데이터를 결합
        if comic and current_panels:
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
                        # 기존 텍스트 데이터에 grid 데이터 추가
                        if isinstance(current_panels[panel_key], dict):
                            current_panels[panel_key]["grid"] = comic_panel.get("grid", [])
                        else:
                            # 문자열인 경우 dict로 변환
                            current_panels[panel_key] = {
                                "content": current_panels[panel_key],
                                "grid": comic_panel.get("grid", [])
                            }
        
        # 백엔드에서 내려주는 focusedPanel 사용
        focused_panel = self._get_focused_panel(journal_entry_id, journal_entry.stage) if journal_entry.stage == JournalEntryStage.ComicContext else None
        print(f"[DEBUG] get_session_info: stage={journal_entry.stage}, focused_panel={focused_panel}")
        
        # 메시지를 프론트엔드에서 사용할 수 있는 형태로 변환
        formatted_messages = []
        if messages:
            for msg in messages:
                formatted_messages.append(ChatMessage(
                    id=msg.id,
                    text=msg.content,
                    isUser=msg.role == MessageRole.User,
                    timestamp=msg.created_at.isoformat() if msg.created_at else None
                ))
        
        # Convert current_panels to ComicData if it exists
        comic_data = None
        if current_panels:
            comic_data = ComicData(
                panel1=current_panels.get("panel1"),
                panel2=current_panels.get("panel2"),
                panel3=current_panels.get("panel3"),
                panel4=current_panels.get("panel4")
            )
        
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
    
    def _wait_for_comic_generation(self, journal_entry_id: str, stage_name: str) -> None:
        """만화 생성이 완료될 때까지 대기"""
        import time
        from backend.database.crud.chatbot import get_comic_status
        
        max_wait_time = 60  # 최대 60초 대기
        wait_interval = 0.5  # 0.5초마다 확인
        
        for _ in range(int(max_wait_time / wait_interval)):
            try:
                # DB에서 직접 만화 생성 상태 확인
                status = get_comic_status(self.db, journal_entry_id)
                
                if status == 'completed':
                    print(f"[DEBUG] {stage_name}: Comic generation completed for {journal_entry_id}")
                    break
                elif status == 'error':
                    print(f"[DEBUG] {stage_name}: Comic generation failed for {journal_entry_id}")
                    break
                
                time.sleep(wait_interval)
            except Exception as e:
                print(f"[DEBUG] {stage_name}: Error checking comic generation status: {e}")
                time.sleep(wait_interval)

    def start_auto_comic_generation(self, journal_entry_id: str) -> Dict[str, Any]:
        """자동 만화 생성 시작"""
        journal_entry = get_journal_entry(self.db, journal_entry_id)
        if not journal_entry:
            raise ValueError("Journal entry not found")
        
        current_stage = journal_entry.stage
        
        if current_stage == JournalEntryStage.Revision1:
            # 만화 생성 완료 대기
            self._wait_for_comic_generation(journal_entry_id, "revision_1")
            
            # comic_context로 전환
            context_stage = ComicContextStage(self.db, journal_entry_id)
            context_response = context_stage.start_context_analysis()
            
            return {
                "response": context_response,
                "stage": "comic_context"
            }
        elif current_stage == JournalEntryStage.ComicContext:
            # 만화 생성 완료 대기
            self._wait_for_comic_generation(journal_entry_id, "comic_context")
            
            # revision_2로 전환
            revision2_stage = Revision2Stage(self.db, journal_entry_id)
            revision2_response = revision2_stage.start_revision()
            
            return {
                "response": revision2_response,
                "stage": "revision_2"
            }
        else:
            return {
                "response": "만화 생성을 시작할 수 없습니다.",
                "stage": "error"
            }
    
    def _get_focused_panel(self, journal_entry_id: str, stage) -> str:
        """현재 질문하고 있는 패널을 찾아서 focusedPanel로 설정"""
        if stage != JournalEntryStage.ComicContext:
            print(f"[DEBUG] _get_focused_panel: stage is not ComicContext, returning None")
            return None
            
        try:
            # ComicContextStage 객체 생성 후 story_analysis 다시 생성
            context_stage = ComicContextStage(self.db, journal_entry_id)
            context_stage.story_analysis = context_stage._analyze_story_flow()  # story_analysis 다시 생성
            
            # story_analysis가 없으면 첫 번째 메시지("짜잔" 메시지)이므로 focusedPanel 설정하지 않음
            if not context_stage.story_analysis:
                print(f"[DEBUG] _get_focused_panel: story_analysis is None (first message), returning None")
                return None
            
            # story_analysis에서 첫 번째로 누락된 정보가 있는 패널 찾기
            content_issues = context_stage.story_analysis.get("content", {})
            panels = ["A", "B", "C", "D"] # Assuming these are the panel keys
            panel_mapping = {"A": "panel1", "B": "panel2", "C": "panel3", "D": "panel4"}
            for panel in panels:
                panel_issues = content_issues.get(panel, [])
                # 빈 문자열이 아닌 첫 번째 패널 찾기
                if panel_issues and any(issue for issue in panel_issues if issue and issue != ''):
                    return panel_mapping[panel]
        except Exception as e:
            print(f"Error getting focused panel: {e}")
        
        print(f"[DEBUG] _get_focused_panel: returning None")
        return None 