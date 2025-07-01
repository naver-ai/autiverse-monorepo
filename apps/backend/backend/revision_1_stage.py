import openai
from typing import Dict, Any, List, Optional
from .database.crud.chatbot import (
    get_journal_entry, update_journal_entry_stage, get_journal, 
    update_journal_data, create_interaction_turn, create_message,
    get_messages_by_journal_entry, update_comic_data
)
from .database.models import JournalEntryStage, MessageRole
from sqlalchemy.orm import Session


class Revision1Stage:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = self._get_child_name()
        # Journal에서 revision_count 가져오기
        self.revision_count = self._get_revision_count()
        self.max_revisions = 2
    
    def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        from .database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name
        return "유찬"  # fallback
    
    def _get_revision_count(self) -> int:
        """Journal에서 revision_count 가져오기"""
        from .database.crud.chatbot import get_journal
        
        journal = get_journal(self.db, self.journal_entry_id)
        if journal:
            return journal.revision_count
        return 0
    
    def _update_revision_count(self, new_count: int) -> None:
        """Journal의 revision_count 업데이트"""
        from .database.crud.chatbot import update_journal_data
        
        update_journal_data(
            self.db, self.journal_entry_id,
            revision_count=new_count
        )
        self.revision_count = new_count
        
    def start_revision(self) -> str:
        """첫 번째 수정 단계 시작"""
        # Journal entry stage 업데이트
        update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision1)
        
        # 새로운 interaction turn 생성
        interaction_turn = create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Revision1
        )
        
        # 첫 번째 수정 질문 생성
        initial_question = "그럼 네가 지금 말해준 내용으로 오늘의 그림일기를 써보자! 먼저 내가 잘 들었는지 확인해줘~ 내가 틀리게 들은 부분이 있을까? 🤔"
        create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_question, MessageRole.Assistant
        )
        
        return initial_question
    
    def process_message(self, user_message: str) -> str:
        """사용자 메시지 처리"""
        # 현재 interaction turn 가져오기
        interaction_turn = self._get_or_create_interaction_turn(JournalEntryStage.Revision1)
        
        # 사용자 메시지 저장
        create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            user_message, MessageRole.User
        )
        
        # 봇 응답 생성
        bot_response = self._generate_response(user_message)
        
        # 봇 응답 저장
        create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            bot_response, MessageRole.Assistant
        )
        
        return bot_response
    
    def _generate_response(self, user_message: str) -> str:
        """사용자 메시지에 대한 응답 생성"""
        
        # "네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까?" 질문에 대한 답변 처리
        if self._is_correction_confirmation_question():
            if self._is_negative_response(user_message):
                return "아앗;; 어디가 어떻게 틀렸어? 😅"
            elif self._is_positive_response(user_message):
                # 수정 완료, 만화 패널 생성 후 다음 단계로
                self._generate_comic_panels()
                update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
                return "좋아! 그럼 이제 만화를 더 완성해볼게! 🎨"
            else:
                return "응 아니 중에 골라줘! 😅"
        
        # "여기서 틀린 부분 있어?" 질문에 대한 답변 처리
        if self.revision_count == 0:
            if self._is_negative_response(user_message):
                # 수정할 부분이 없다면 comic_intro를 revision_1에 저장하고 만화 패널 생성 후 다음 단계로
                journal = get_journal(self.db, self.journal_entry_id)
                if journal and journal.comic_intro:
                    update_journal_data(
                        self.db, self.journal_entry_id,
                        revision_1=journal.comic_intro
                    )
                self._generate_comic_panels()
                update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
                return "좋아! 그럼 이제 만화를 더 완성해볼게! 🎨"
            elif self._is_positive_response(user_message):
                new_count = self.revision_count + 1
                self._update_revision_count(new_count)
                if self.revision_count > self.max_revisions:
                    return "장난치지마~ 😤"
                elif self.revision_count == self.max_revisions:
                    return "아앗;; 이제 마지막 기회야! 지금 틀린 부분이 있다면 다 말해줘~ 😅"
                else:
                    return "아앗;; 어디가 어떻게 틀렸어? 😅"
            else:
                # 구체적인 수정 내용이 들어온 경우 (revision_count가 0이어도)
                try:
                    self._apply_user_correction(user_message)
                    return "네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까? 🤔"
                except Exception as e:
                    print(f"[DEBUG] revision_1: Error applying user correction: {e}")
                    return "수정하는데 문제가 생겼어. 다시 말해줘! 😅"
        
        # revision_count가 1 이상인 경우의 구체적인 수정 내용 처리
        try:
            self._apply_user_correction(user_message)
            return "네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까? 🤔"
        except Exception as e:
            print(f"[DEBUG] revision_1: Error applying user correction: {e}")
            return "수정하는데 문제가 생겼어. 다시 말해줘! 😅"
    
    def _is_correction_confirmation_question(self) -> bool:
        """현재 질문이 수정 확인 질문인지 확인"""
        messages = get_messages_by_journal_entry(self.db, self.journal_entry_id)
        if messages:
            # 현재 사용자 메시지가 저장되기 전의 마지막 봇 메시지를 찾기 위해 -2 인덱스 사용
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].role == MessageRole.Assistant:
                    last_bot_message = messages[i].content
                    result = "네가 말해준 내용대로 바꿔봤어" in last_bot_message
                    return result
            return False
        return False
    
    def _is_negative_response(self, message: str) -> bool:
        """부정적인 응답인지 확인"""
        negative_keywords = ["아니", "no", "n", "틀렸어", "아니야"]
        result = any(keyword in message.lower() for keyword in negative_keywords)
        return result
    
    def _is_positive_response(self, message: str) -> bool:
        """긍정적인 응답인지 확인"""
        positive_keywords = ["응", "네", "yes", "y", "맞아", "좋아"]
        result = any(keyword in message.lower() for keyword in positive_keywords)
        return result
    
    def _apply_user_correction(self, correction: str) -> None:
        """사용자 수정 내용 적용"""
        journal = get_journal(self.db, self.journal_entry_id)
        if not journal or not journal.comic_intro:
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

        current_panels = journal.comic_intro
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
            
            # Journal에 수정된 데이터 저장 (revision_1 필드에만 저장)
            update_journal_data(
                self.db, self.journal_entry_id,
                revision_1=updated_panels
            )
            
        except json.JSONDecodeError as e:
            print(f"[DEBUG] revision_1: Failed to parse revision response: {e}")
        except Exception as e:
            print(f"[DEBUG] revision_1: Unexpected error in _apply_user_correction: {e}")
    
    # def _apply_final_corrections(self) -> None:
    #     """최종 수정사항 적용 (revision_1을 comic_intro에 반영) - 사용하지 않음"""
    #     pass
    
    def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> Any:
        """현재 단계의 interaction turn 가져오기 또는 생성"""
        from .database.crud.chatbot import get_latest_interaction_turn
        
        latest_turn = get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            return create_interaction_turn(self.db, self.journal_entry_id, stage)

    def _generate_comic_panels(self) -> None:
        """revision_1 단계가 끝날 때 만화 패널 생성"""
        try:
            from .utils.comic_grid_generator import ComicGridGenerator
            
            journal = get_journal(self.db, self.journal_entry_id)
            if not journal or not journal.revision_1:
                return
            
            # revision_1 데이터를 사용하여 만화 패널 생성
            generator = ComicGridGenerator()
            comic_grids = generator.generate_comic_grids(journal.revision_1)
            
            # Comic 테이블에 저장
            update_comic_data(
                self.db, self.journal_entry_id,
                first_panel1=comic_grids.get('panel1'),
                first_panel2=comic_grids.get('panel2'),
                first_panel3=comic_grids.get('panel3'),
                first_panel4=comic_grids.get('panel4')
            )
        except Exception as e:
            print(f"[DEBUG] revision_1: Error generating comic panels: {e}")
    
    def get_initial_question(self) -> str:
        """첫 번째 수정 질문을 반환합니다."""
        return "여기서 틀린 부분 있어? 🤔"
    
 