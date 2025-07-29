from typing import Dict, Any
from backend.database.crud.chatbot import *
from .completion_message_generator import CompletionMessageGenerator
from backend.database.models import MessageIntent
from sqlmodel import Session
import json
import openai


class Revision2Stage:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = self._get_child_name()
        # Journal에서 revision_count 가져오기
        self.revision_count = self._get_revision_count()
        self.max_revisions = 2
        self.completion_message_generator = CompletionMessageGenerator()
    
    def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        from backend.database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            child_name = journal_entry.dyad.child_name
            return child_name
        else:
            return "사용자"  # fallback
    
    def _get_revision_count(self) -> int:
        """Journal에서 revision_2_count 가져오기"""
        from backend.database.crud.chatbot import get_journal
        
        journal = get_journal(self.db, self.journal_entry_id)
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
    
    def _update_revision_count(self, new_count: int) -> None:
        """Journal의 revision_2_count 업데이트"""
        from backend.database.crud.chatbot import update_journal_data
        
        update_journal_data(
            self.db, self.journal_entry_id,
            revision_2_count=new_count
        )
        self.revision_count = new_count
        
    def start_revision(self) -> tuple[str, MessageIntent]:
        """두 번째 수정 단계 시작"""
        # Journal entry stage 업데이트
        update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision2)
        
        # 새로운 interaction turn 생성
        interaction_turn = create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Revision2
        )
        
        # Comic 테이블에서 second_panel 데이터 불러오기
        from backend.database.crud.chatbot import get_comic
        comic = get_comic(self.db, self.journal_entry_id)
        
        if comic:
            # second_panel 데이터가 있으면 Journal의 revision_2에 저장
            second_panels = {}
            for i in range(1, 5):
                panel_data = getattr(comic, f"second_panel{i}", None)
                if panel_data and isinstance(panel_data, dict):
                    second_panels[f"panel{i}"] = panel_data.get("content", "")
                else:
                    second_panels[f"panel{i}"] = ""
            
            # Journal의 revision_2 필드에 저장
            if any(second_panels.values()):
                update_journal_data(
                    self.db, self.journal_entry_id,
                    revision_2=second_panels
                )
                print(f"[DEBUG] revision_2: Loaded second_panel data: {second_panels}")
        
        # 첫 번째 수정 질문 생성
        initial_question = "우와앙~ 우리가 같이 만든 그림일기다! 지금부터 내용이 제대로 들어갔는지 확인해보자~ 수정하거나 추가하고 싶은 부분 있어? 🤔"
        create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_question, MessageRole.Assistant, JournalEntryStage.Revision2,
            intent=MessageIntent.PromptRevision2IssueExist
        )
        
        return initial_question, MessageIntent.PromptRevision2IssueExist
    
    def process_message(self, user_message: str, user_intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """사용자 메시지 처리"""
        # 현재 interaction turn 가져오기
        interaction_turn = self._get_or_create_interaction_turn(JournalEntryStage.Revision2)
        
        # 사용자 메시지 저장 (audio_filename 포함)
        create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            user_message, MessageRole.User, JournalEntryStage.Revision2,
            audio_filename=audio_filename,
            intent=user_intent
        )
        
        # 봇 응답 생성
        bot_response, intent = self._generate_response(user_message, user_intent)
        
        # 봇 응답 저장
        message = create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            bot_response, MessageRole.Assistant, JournalEntryStage.Revision2,
            intent=intent
        )
        
        return message
    
    def _generate_response(self, user_message: str, user_intent: MessageIntent) -> tuple[str, MessageIntent]:
        """사용자 메시지에 대한 응답 생성"""
        
        # "네가 말해준 내용대로 바꿔봤어. 더 추가하거나 바꿀 곳 있어?" 질문에 대한 답변 처리
        if self._is_correction_confirmation_question():
            if self._is_negative_response(user_message, user_intent): #수정할 곳이 있다
                # 수정할 부분이 있다면 revision_count 증가하고 수정 요청
                new_count = self.revision_count + 1
                self._update_revision_count(new_count)
                print(f"[DEBUG] revision_2: revision_count: {self.revision_count}")
                if self.revision_count > self.max_revisions:
                    return "장난치지 말구! 😤 이제 진짜 진짜 마지막 기회다! 정말로 수정하거나 추가하고 싶은 부분이 있다면 말해줘~", MessageIntent.PromptOpenEndedAnswer
                elif self.revision_count == self.max_revisions:
                    return "아앗;; 이제 마지막 기회야! 지금 수정하거나 추가하고 싶은 부분이 있다면 다 말해줘~ 😅", MessageIntent.PromptOpenEndedAnswer
                else:
                    return "어디를 어떻게 수정해볼까?? 🤔", MessageIntent.PromptOpenEndedAnswer
            elif self._is_positive_response(user_message, user_intent): #수정할 곳이 없다
                # 수정 완료, 완료 단계로
                self._complete_journal_entry()
                # 완성된 그림 일기 내용을 바탕으로 개인화된 마무리 메시지 생성
                comic_data = self._get_completed_comic_data()
                completion_message = self.completion_message_generator.generate_completion_message(comic_data, self.child_name)
                return completion_message, MessageIntent.TransitionToTitle
            else:
                print(f"[DEBUG] revision_2: _generate_response: intent={user_intent}, Should not reach here!!")
                raise Exception("Revision 2: Correction confirmation questions must be answered through intent")
        else:
            # 구체적인 수정 내용이 들어온 경우
            try:
                self._apply_user_correction(user_message)
                return "네가 말해준 내용대로 바꿔봤어. 더 추가하거나 바꿀 곳 있어? 🤔", MessageIntent.PromptRevision2IssueExist
            except Exception as e:
                print(f"[DEBUG] revision_2: Error applying user correction: {e}")
                return "수정하는데 문제가 생겼어. 다시 말해줘! 😅", MessageIntent.PromptOpenEndedAnswer
    
    def _is_correction_confirmation_question(self) -> bool:
        """현재 질문이 수정 확인 질문인지 확인"""
        messages = get_messages_by_journal_entry(self.db, self.journal_entry_id)
        if messages:
            # 현재 사용자 메시지가 저장되기 전의 마지막 봇 메시지를 찾기 위해 -2 인덱스 사용
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].role == MessageRole.Assistant:
                    return messages[i].intent in [MessageIntent.PromptIssueExist, MessageIntent.PromptRevision2IssueExist]
            return False
        return False
    
    def _is_negative_response(self, message: str, user_intent: MessageIntent) -> bool:
        """부정적인 응답인지 확인"""
        if user_intent == MessageIntent.AnswerNegative:
            return True
        else:
            negative_keywords = ["없어"]
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
    
    def _apply_user_correction(self, correction: str) -> None:
        """사용자 수정 내용 적용"""
        journal = get_journal(self.db, self.journal_entry_id)
        if not journal or not journal.revision_2:
            return
        
        # OpenAI로 수정 적용
        client = openai.OpenAI()
        
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
11. Output exactly this JSON format with ONLY the panels that need to change:

{
  "panel1": "new content only if panel1 needs to change",
  "panel2": "new content only if panel2 needs to change", 
  "panel3": "new content only if panel3 needs to change",
  "panel4": "new content only if panel4 needs to change"
}

12. **DO NOT include panels that should remain unchanged**
13. **DO NOT include panels that should be null**
14. Write in natural Korean
15. **IMPORTANT**: Make sure the story remains coherent and logical after revision"""

        current_panels = journal.revision_2
        user_prompt = f"""Current comic panels:
"panel1": "{current_panels.get('panel1', 'null')}",
"panel2": "{current_panels.get('panel2', 'null')}",
"panel3": "{current_panels.get('panel3', 'null')}",
"panel4": "{current_panels.get('panel4', 'null')}"

User's correction request: {correction}
"""

        response = client.chat.completions.create(
            model="gpt-4.1-mini-2025-04-14",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.1,
            max_tokens=500
        )

        revised_panels = response.choices[0].message.content
        
        import json
        try:
            revised_data = json.loads(revised_panels)
            
            # 수정된 패널들만 업데이트
            updated_panels = current_panels.copy()
            for panel_key, new_content in revised_data.items():
                if panel_key in updated_panels:
                    updated_panels[panel_key] = new_content if new_content != "null" else None
            
            # Journal에 수정된 데이터 저장
            update_journal_data(
                self.db, self.journal_entry_id,
                revision_2=updated_panels
            )
            
        except json.JSONDecodeError as e:
            print(f"[DEBUG] revision_2: Failed to parse revision response: {e}")
        except Exception as e:
            print(f"[DEBUG] revision_2: Unexpected error in _apply_user_correction: {e}")
    
    def _complete_journal_entry(self) -> None:
        """journal entry 완료 처리"""        
        try:
            # 최종 수정사항 적용 (revision_2를 comic_context에 반영)
            journal = get_journal(self.db, self.journal_entry_id)
            if journal and journal.revision_2:
                update_journal_data(
                    self.db, self.journal_entry_id,
                    comic_context=journal.revision_2
                )
                
        except Exception as e:
            print(f"[DEBUG] revision_2: Error in _complete_journal_entry: {e}")
            raise
    

    
    def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> InteractionTurn:
        """현재 단계의 interaction turn 가져오기 또는 생성"""
        from backend.database.crud.chatbot import get_latest_interaction_turn
        
        latest_turn = get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            return create_interaction_turn(self.db, self.journal_entry_id, stage)

    def _get_completed_comic_data(self) -> Dict[str, Any]:
        """완성된 그림 일기 데이터 가져오기"""
        from backend.database.crud.chatbot import get_journal
        
        journal = get_journal(self.db, self.journal_entry_id)
        if journal:
            # revision_2가 있으면 우선 사용, 없으면 comic_context 사용
            return journal.revision_2 if journal.revision_2 else journal.comic_context
        return {}
    
    def get_initial_question(self) -> tuple[str, MessageIntent]:
        """첫 번째 수정 질문을 반환합니다."""
        return "우와앙~ 우리가 같이 만든 그림일기다! 지금부터 내용이 제대로 들어갔는지 확인해보자~ 수정하거나 추가하고 싶은 부분 있어? 🤔", MessageIntent.PromptRevision2IssueExist