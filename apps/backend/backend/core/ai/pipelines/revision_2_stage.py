from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import *
from .completion_message_generator import CompletionMessageGenerator
from backend.database.models import MessageIntent
from sqlmodel import Session
import json
import openai
import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

class PanelRevision2(BaseModel):
    """Panel revision result for revision 2"""
    panel1: Optional[str] = Field(description="Panel 1 content")
    panel2: Optional[str] = Field(description="Panel 2 content")
    panel3: Optional[str] = Field(description="Panel 3 content")
    panel4: Optional[str] = Field(description="Panel 4 content")

class Revision2Stage:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = None
        # Journal에서 revision_count 가져오기
        self.revision_count = None
        self.max_revisions = 2
        self.completion_message_generator = CompletionMessageGenerator()
        
        # LangChain setup
        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.1,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.revision_parser = PydanticOutputParser(pydantic_object=PanelRevision2)
    
    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'Revision2Stage':
        """비동기 팩토리 메서드"""
        instance = cls(db, journal_entry_id)
        instance.child_name = await instance._get_child_name()
        instance.revision_count = await instance._get_revision_count()
        return instance
    
    async def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        
        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            child_name = journal_entry.dyad.child_name
            return child_name
        else:
            return "사용자"  # fallback
    
    async def _get_revision_count(self) -> int:
        """Journal에서 revision_2_count 가져오기"""
        from backend.database.crud.chatbot import get_journal
        
        journal = await get_journal(self.db, self.journal_entry_id)
        if journal:
            return journal.revision_2_count
        return 0
    
    def _get_vocative_particle(self, name: str) -> str:
        """한국어 종성에 따른 호격 조사 처리 함수"""
        if not name or len(name) == 0:
            return ''
        
        last_char = name[-1]
        code = ord(last_char)
        
        # 한글 범위 체크 (가-힣: 44032-55203)
        if code < 44032 or code > 55203:
            return ''
        
        # 종성 계산: (유니코드 - 44032) % 28
        unicode_val = code - 44032
        jong = unicode_val % 28
        
        # 종성이 있으면 '이', 없으면 ''
        return '이' if jong != 0 else ''
    
    async def _update_revision_count(self, new_count: int) -> None:
        """Journal의 revision_2_count 업데이트"""
        from backend.database.crud.chatbot import update_journal_data
        
        await update_journal_data(
            self.db, self.journal_entry_id,
            revision_2_count=new_count
        )
        self.revision_count = new_count
        
    async def start_revision(self) -> tuple[str, MessageIntent]:
        """두 번째 수정 단계 시작"""
        # Journal entry stage 업데이트
        await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision2)
        
        # 새로운 interaction turn 생성
        interaction_turn = await create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Revision2
        )
        
        # 하드코딩된 패널 데이터 설정
        # hardcoded_panels = {
        #     "panel1": {
        #         "content": "I played with Oliver at school today using an eraser.",
        #         "place": "School",
        #         "grid": [
        #             {"type": "figure", "content": "Me", "position": [1, 2]},
        #             {"type": "object", "content": "eraser", "position": [2, 2]},
        #             {"type": "figure", "content": "Oliver", "position": [3, 2]}
        #         ]
        #     },
        #     "panel2": {
        #         "content": "I threw his eraser without asking for playing.",
        #         "place": "",
        #         "grid": [
        #             {"type": "figure", "content": "Me", "position": [2, 2]},
        #             {"type": "object", "content": "eraser", "position": [2, 3]}
        #         ]
        #     },
        #     "panel3": {
        #         "content": "Oliver got angry and told the teacher.",
        #         "place": "",
        #         "grid": [
        #             {"type": "figure", "content": "Oliver", "position": [1, 2], "action": [{"type": "emotion", "content": "Angry"}, {"type": "tell", "content": "Ethan threw my eraser without asking"}]},
        #             {"type": "figure", "content": "Teacher", "position": [3, 2]}
        #         ]
        #     },
        #     "panel4": {
        #         "content": "I was sad and scared.",
        #         "place": "",
        #         "grid": [
        #             {"type": "figure", "content": "Me", "position": [2, 2], "action": [{"type": "emotion", "content": "Sad"}, {"type": "emotion", "content": "Scared"}]}
        #         ]
        #     }
        # } #- English

        hardcoded_panels = {
            "panel1": {
                "content": "나는 오늘 은우랑 학교에서 지우개를 가지고 놀았다.",
                "place": "학교",
                "grid": [
                    {"type": "figure", "content": "나", "position": [1, 2]},
                    {"type": "object", "content": "지우개", "position": [2, 2]},
                    {"type": "figure", "content": "은우", "position": [3, 2]}
                ]
            },
            "panel2": {
                "content": "나는 은우한테 물어보지도 않고 은우 지우개를 썼다.",
                "place": "",
                "grid": [
                    {"type": "figure", "content": "나", "position": [2, 2]},
                    {"type": "object", "content": "지우개", "position": [2, 3]}
                ]
            },
            "panel3": {
                "content": "은우가 화를 내고 선생님께 말씀드렸다.",
                "place": "",
                "grid": [
                    {"type": "figure", "content": "은우", "position": [1, 2], "action": [{"type": "emotion", "content": "화남"}, {"type": "tell", "content": "민준이가 물어보지도 않고 제 지우개 던졌어요!"}]},
                    {"type": "figure", "content": "선생님", "position": [3, 2]}
                ]
            },
            "panel4": {
                "content": "나는 슬프고 무서웠다.",
                "place": "",
                "grid": [
                    {"type": "figure", "content": "나", "position": [2, 2], "action": [{"type": "emotion", "content": "슬픔"}, {"type": "emotion", "content": "무서움"}]}
                ]
            }
        }
        
        # Journal의 revision_2 필드에 하드코딩된 패널 데이터 저장
        await update_journal_data(
            self.db, self.journal_entry_id,
            revision_2=hardcoded_panels
        )
        print(f"[DEBUG] revision_2: Set hardcoded panel data: {hardcoded_panels}")
        
        # 첫 번째 수정 질문 생성
        # initial_question = "Wow! Look at the journal we made together! Let's check now to see if everything is included properly. Is there anything you'd like to change or add? 🤔" #- English
        initial_question = "우와앙~ 우리가 같이 만든 그림일기다! 지금부터 내용이 제대로 들어갔는지 확인해보자. 수정하거나 추가하고 싶은 부분 있어? 🤔" #- Korean
        await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_question, MessageRole.Assistant, JournalEntryStage.Revision2,
            intent=MessageIntent.PromptRevision2IssueExist
        )
        
        return initial_question, MessageIntent.PromptRevision2IssueExist
    
    async def process_message(self, user_message: str, user_intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """사용자 메시지 처리 - Structured Output 사용"""
        # 현재 interaction turn 가져오기
        interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.Revision2)
        
        # 사용자 메시지 저장 (audio_filename 포함)
        await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            user_message, MessageRole.User, JournalEntryStage.Revision2,
            audio_filename=audio_filename,
            intent=user_intent
        )
        
        # 봇 응답 생성
        bot_response, intent = await self._generate_response(user_message, user_intent)
        
        # 봇 응답 저장
        message = await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            bot_response, MessageRole.Assistant, JournalEntryStage.Revision2,
            intent=intent
        )
        
        return message
    
    async def _generate_response(self, user_message: str, user_intent: MessageIntent) -> tuple[str, MessageIntent]:
        """사용자 메시지에 대한 응답 생성 - Structured Output 사용"""
        
        # "네가 말해준 내용대로 바꿔봤어. 더 추가하거나 바꿀 곳 있어?" 질문에 대한 답변 처리
        if await self._is_correction_confirmation_question():
            if self._is_negative_response(user_message, user_intent): #수정할 곳이 있다
                # 수정할 부분이 있다면 revision_count 증가하고 수정 요청
                new_count = self.revision_count + 1
                await self._update_revision_count(new_count)
                print(f"[DEBUG] revision_2: revision_count: {self.revision_count}")
                if self.revision_count > self.max_revisions:
                    return "장난치지 말구! 😤 이제 진짜 진짜 마지막 기회다! 정말로 수정하거나 추가하고 싶은 부분이 있다면 말해줘~", MessageIntent.PromptOpenEndedAnswer
                elif self.revision_count == self.max_revisions:
                    return "아앗;; 이제 마지막 기회야! 지금 수정하거나 추가하고 싶은 부분이 있다면 다 말해줘~ 😅", MessageIntent.PromptOpenEndedAnswer
                else:
                    # return "Which part do you want to change, and how? 🤔", MessageIntent.PromptOpenEndedAnswer #- English
                    return "어디를 어떻게 수정해볼까?? 🤔", MessageIntent.PromptOpenEndedAnswer #- Korean
            elif self._is_positive_response(user_message, user_intent): #수정할 곳이 없다
                # 수정 완료, 완료 단계로
                # 하드코딩된 마무리 메시지 사용
                # completion_message = "So, you and Oliver had a falling out at school and hurt each other's feelings. It breaks my heart to hear that you felt sad and scared. I'll be rooting for better things to happen for you next time! Now let's press the 'Next' button and go choose a title for the journal!"
                completion_message = "오늘 학교에서 은우랑 다퉈서 속상했겠다. 네가 슬프고 무서웠다니까 나까지 마음이 다 안 좋아..😥 다음번엔 분명히 다 잘 풀릴 거야! 내가 옆에서 응원할게! 이제 '다음' 버튼을 눌러서 오늘 일기의 제목을 고르러 가자!"
                return completion_message, MessageIntent.TransitionToTitle
            else:
                print(f"[DEBUG] revision_2: _generate_response: intent={user_intent}, Should not reach here!!")
                raise Exception("Revision 2: Correction confirmation questions must be answered through intent")
        else:
            # 구체적인 수정 내용이 들어온 경우
            try:
                # "which part do you want to change and how" 질문에 대한 답변인지 확인
                if await self._is_which_part_question():
                    print(f"[DEBUG] revision_2: Detected which part question response, applying hardcoded panel3 update")
                    # 하드코딩된 panel 3 업데이트를 revision_2 필드에 저장 (comic_context와 같은 방식)
                    journal = await get_journal(self.db, self.journal_entry_id)
                    if journal and journal.revision_2:
                        updated_panels = journal.revision_2.copy()
                        # updated_panels["panel3"] = {
                        #     "content": "I apologized to him after he got angry and told the teacher.",
                        #     "place": "",
                        #     "grid": [
                        #         {"type": "figure", "content": "Oliver", "position": [1, 2], "action": [{"type": "emotion", "content": "Angry"}, {"type": "tell", "content": "Ethan threw my eraser without asking"}]},
                        #         {"type": "figure", "content": "Teacher", "position": [3, 2]}
                        #     ]
                        # } #- English
                        
                        updated_panels["panel3"] = {
                            "content": "은우가 화를 내고 선생님께 말씀드린 후 나는 은우에게 사과했다.",
                            "place": "",
                            "grid": [
                                {"type": "figure", "content": "은우", "position": [1, 2], "action": [{"type": "emotion", "content": "화남"}, {"type": "tell", "content": "민준이가 허락도 안 받고 제 지우개 던졌어요!"}]},
                                {"type": "figure", "content": "선생님", "position": [3, 2]}
                            ]
                        }

                        # revision_2 필드에 업데이트된 패널 데이터 저장 (comic_context와 같은 방식)
                        await update_journal_data(
                            self.db, self.journal_entry_id,
                            revision_2=updated_panels
                        )
                        print(f"[DEBUG] revision_2: Updated panel3 in revision_2 field: {updated_panels['panel3']}")
                else:
                    await self._apply_user_correction(user_message)
                # return "I changed it according to what you told me. Is everything correct now? 🤔", MessageIntent.PromptRevision2Confirm #- English
                return "네가 말해준 내용대로 바꿔봤어. 더 추가하거나 바꿀 곳 있어? 🤔", MessageIntent.PromptRevision2Confirm #- Korean
            except Exception as e:
                print(f"[DEBUG] revision_2: Error applying user correction: {e}")
                return "수정하는데 문제가 생겼어. 다시 말해줘! 😅", MessageIntent.PromptOpenEndedAnswer
    
    async def _is_correction_confirmation_question(self) -> bool:
        """현재 질문이 수정 확인 질문인지 확인"""
        messages = await get_messages_by_journal_entry(self.db, self.journal_entry_id)
        if messages:
            # 현재 사용자 메시지가 저장되기 전의 마지막 봇 메시지를 찾기 위해 -2 인덱스 사용
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].role == MessageRole.Assistant:
                    return messages[i].intent in [MessageIntent.PromptRevision2IssueExist, MessageIntent.PromptRevision2Confirm]
            return False
        return False
    
    def _is_negative_response(self, message: str, user_intent: MessageIntent) -> bool:
        """부정적인 응답인지 확인"""
        if user_intent == MessageIntent.AnswerNegative:
            return True
        else:
            negative_keywords = ["없어", "something to fix", "something to change", "fix", "change", "wrong", "not correct", "problem", "issue"]
            result = any(keyword in message.lower() for keyword in negative_keywords)
            return result
    
    def _is_positive_response(self, message: str, user_intent: MessageIntent) -> bool:
        """긍정적인 응답인지 확인"""
        if user_intent == MessageIntent.AnswerPositive:
            return True
        else:
            positive_keywords = ["있어"]
            result = any(keyword in message.lower() for keyword in positive_keywords)
            return result
    
    async def _is_which_part_question(self) -> bool:
        """현재 질문이 "Which part do you want to change, and how?" 질문인지 확인"""
        messages = await get_messages_by_journal_entry(self.db, self.journal_entry_id)
        print(f"[DEBUG] revision_2: _is_which_part_question: checking {len(messages)} messages")
        
        if messages:
            # 현재 사용자 메시지가 저장되기 전의 마지막 봇 메시지를 찾기
            for i in range(len(messages) - 2, -1, -1):  # -2부터 시작 (현재 사용자 메시지 제외)
                if messages[i].role == MessageRole.Assistant:
                    # is_which_part = messages[i].intent == MessageIntent.PromptOpenEndedAnswer and "which part" in messages[i].content.lower()
                    is_which_part = messages[i].intent == MessageIntent.PromptOpenEndedAnswer and "어디를" in messages[i].content
                    print(f"[DEBUG] revision_2: Checking message {i}: role={messages[i].role}, intent={messages[i].intent}, content='{messages[i].content}', is_which_part={is_which_part}")
                    if is_which_part:
                        return True
            print(f"[DEBUG] revision_2: No which part question found")
            return False
        print(f"[DEBUG] revision_2: No messages found")
        return False
    
    
    
    async def _apply_user_correction(self, correction: str) -> None:
        """사용자 수정 내용 적용 - Structured Output 사용"""
        journal = await get_journal(self.db, self.journal_entry_id)
        if not journal or not journal.revision_2:
            return
        
        system_prompt = """You are a revision assistant that helps fix 4-panel comic stories based on user feedback.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

REVISION RULES:
1. **ONLY modify the specific panel(s) that the user wants to change**
2. **KEEP all other panels exactly as they are**
3. When user corrects only the ACTION/BEHAVIOR, preserve the LOCATION/CONTEXT
4. When user corrects LOCATION/PLACE, replace the entire location context
5. When user says something is "not correct" or "wrong", identify what part is wrong:
   - If it's the ACTION: keep location, change action
   - If it's the LOCATION: change location completely
   - If it's the WHOLE SENTENCE: replace completely

6. Understand the user's correction request and apply it appropriately
7. Maintain the ABCD structure while making the requested changes
8. Keep each panel to one Korean past-tense sentence, first-person diary style
9. **CRITICAL**: Only change what the user specifically requested
10. Preserve the overall story flow and coherence
11. **IMPORTANT**: You must return ALL 4 panels (panel1, panel2, panel3, panel4) in the JSON output
12. **For panels that should remain unchanged, use the current content**
13. **For panels that should be null, use null value**
14. Write in natural Korean
15. **IMPORTANT**: Make sure the story remains coherent and logical after revision

OUTPUT FORMAT:
Return a JSON object with all 4 panels: {"panel1": "...", "panel2": "...", "panel3": "...", "panel4": "..."}"""

        current_panels = journal.revision_2
        user_prompt = f"""Current comic panels:
"panel1": "{current_panels.get('panel1', 'null')}",
"panel2": "{current_panels.get('panel2', 'null')}",
"panel3": "{current_panels.get('panel3', 'null')}",
"panel4": "{current_panels.get('panel4', 'null')}"

User's correction request: {correction}
"""

        # Retry logic for structured output
        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                
                response = await self.llm.ainvoke(messages)
                result = self.revision_parser.parse(response.content)
                
                # 수정된 패널들만 업데이트
                updated_panels = current_panels.copy()
                if result.panel1 is not None:
                    updated_panels["panel1"] = result.panel1 if result.panel1 != "null" else None
                if result.panel2 is not None:
                    updated_panels["panel2"] = result.panel2 if result.panel2 != "null" else None
                if result.panel3 is not None:
                    updated_panels["panel3"] = result.panel3 if result.panel3 != "null" else None
                if result.panel4 is not None:
                    updated_panels["panel4"] = result.panel4 if result.panel4 != "null" else None
                
                # Journal에 수정된 데이터 저장
                await update_journal_data(
                    self.db, self.journal_entry_id,
                    revision_2=updated_panels
                )
                
                print(f"Panel Revision 2 Result: {updated_panels}")
                return
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed for panel revision 2")
                    return
                await asyncio.sleep(1)  # Brief delay before retry

    
    async def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> InteractionTurn:
        """현재 단계의 interaction turn 가져오기 또는 생성"""
        from backend.database.crud.chatbot import get_latest_interaction_turn
        
        latest_turn = await get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            from backend.database.crud.chatbot import create_interaction_turn
            return await create_interaction_turn(self.db, self.journal_entry_id, stage)

    async def _get_completed_comic_data(self) -> Dict[str, Any]:
        """완성된 그림 일기 데이터 가져오기"""
        from backend.database.crud.chatbot import get_journal
        
        journal = await get_journal(self.db, self.journal_entry_id)
        if journal:
            # revision_2가 있으면 우선 사용, 없으면 comic_context 사용
            return journal.revision_2 if journal.revision_2 else journal.comic_context
        return {}
    
    def get_initial_question(self) -> tuple[str, MessageIntent]:
        """첫 번째 수정 질문을 반환합니다."""
        return "우와앙~ 우리가 같이 만든 그림일기다! 지금부터 내용이 제대로 들어갔는지 확인해보자. 수정하거나 추가하고 싶은 부분 있어? 🤔", MessageIntent.PromptRevision2IssueExist