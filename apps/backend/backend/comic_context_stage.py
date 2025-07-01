from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import *
from backend.database.crud.chatbot import update_journal_entry_stage, update_comic_panels, update_comic_data


from sqlmodel import Session
import json
import openai
import os



@dataclass
class ComicPanel:
    """Comic panel data structure"""
    content: Optional[str]
    missing_content: Optional[str] = None

class ComicContextStage:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = self._get_child_name()
        self.child_age = self._get_child_age()
        self.child_gender = self._get_child_gender()
        self.agent_name = self._get_agent_name()
        self.agent_interests = self._get_agent_interests()
        self.story_analysis = None
        self.comic_context_history: List[Dict[str, str]] = []
        print(f"[DEBUG] comic_context: initialized with child_name={self.child_name}, agent_name={self.agent_name}")
    
    def _get_child_name(self) -> str:
        """dyad의 child_name을 가져오기"""
        from .database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name
        return "사용자"  # fallback
    
    def _get_child_age(self) -> int:
        """dyad의 child_age를 가져오기"""
        from .database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_age
        return 15  # fallback
    
    def _get_agent_name(self) -> str:
        """agent의 agent_name을 가져오기"""
        from .database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad and journal_entry.dyad.agents:
            # 첫 번째 agent의 이름을 사용
            return journal_entry.dyad.agents[0].agent_name
        return "도도"  # fallback
    
    def _get_agent_interests(self) -> list[str]:
        """agent의 interest 목록을 가져오기"""
        from .database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad and journal_entry.dyad.agents:
            # 모든 agent의 interest를 수집
            interests = []
            for agent in journal_entry.dyad.agents:
                if agent.interest:
                    interests.append(agent.interest)
            return interests
        return ["Dinosaurs", "Counting things", "Talking to himself"]  # fallback
    
    def _get_child_gender(self) -> str:
        """dyad의 child_gender를 가져오기"""
        from .database.crud.chatbot import get_journal_entry
        
        journal_entry = get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_gender
        return "male"  # fallback
    
    def get_character_background(self) -> str:
        """동적으로 character background 생성"""
        return f"""[Character Background]
You are a {self.child_age}-year-old Korean middle school student named {self.agent_name}.
You're having a friendly conversation with your autistic best friend, {self.child_name} (also {self.child_gender}).

{self.child_name}'s special interests:
{chr(10).join([f"- {interest}" for interest in self.agent_interests])}

[General Speaking Rules]
1. Use informal Korean like talking to a peer friend. Do not use honorifics.
2. Keep responses short and simple - one or two sentences maximum.
3. Use emojis appropriately.
4. Ask only one question per turn.
5. Never apologize or say sorry.
6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
7. If the user brings up special interests, show interest but gently guide back to the main topic.
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.
"""
        
    def start_context_analysis(self) -> str:
        """만화 컨텍스트 분석 시작"""
        try:
            # Journal entry stage 업데이트
            update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
            
            # comic_context 시작 시 만화 패널 생성
            self._generate_initial_comic_panels()
            
            # 새로운 interaction turn 생성
            interaction_turn = create_interaction_turn(
                self.db, self.journal_entry_id, JournalEntryStage.ComicContext
            )
            
            # 첫 번째 분석 질문 생성
            initial_question = self._generate_first_question()
            
            create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                initial_question, MessageRole.Assistant
            )
            
            return initial_question
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in start_context_analysis: {e}")
            raise
    
    def process_message(self, user_message: str) -> str:
        """사용자 메시지 처리"""
        print(f"[DEBUG] comic_context: process_message called with user_message='{user_message}'")
        try:
            # 현재 interaction turn 가져오기
            interaction_turn = self._get_or_create_interaction_turn(JournalEntryStage.ComicContext)
            
            # 사용자 메시지 저장
            create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                user_message, MessageRole.User
            )
            
            # 첫 번째 메시지인 경우 분석 수행
            print(f"[DEBUG] comic_context: story_analysis = {self.story_analysis}")
            if not self.story_analysis:
                self.story_analysis = self._analyze_story_flow()
                print(f"[DEBUG] comic_context: story_analysis created: {self.story_analysis}")
                self._reconstruct_panel(user_message, "", True)
            else:
                self._reconstruct_panel(user_message, "사용자 입력", False)
                # 재구성 후 분석 업데이트
                self.story_analysis = self._analyze_story_flow()
            
            # 다음 질문 생성
            next_question = self._get_next_question()
            
            # 봇 응답 저장
            create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                next_question, MessageRole.Assistant
            )
            
            return next_question
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in process_message: {e}")
            import traceback
            traceback.print_exc()
            return "미안해! 다시 말해줘! 😅"
    
    def _analyze_story_flow(self) -> Dict[str, Any]:
        """스토리 플로우 분석"""
        journal = get_journal(self.db, self.journal_entry_id)
        if not journal:
            return {"A": [], "B": [], "C": [], "D": [], "Order": []}
        
        # comic_context가 있으면 그것을 사용, 없으면 revision_1 사용
        panels_content = journal.comic_context if journal.comic_context else journal.revision_1
        if not panels_content:
            return {"A": [], "B": [], "C": [], "D": [], "Order": []}
        
        client = openai.OpenAI()
        
        system_prompt = """You are "ABCD-Diary Reviewer."

────────────────────
INPUT (always 4 lines)
────────────────────
panel1  = A - Antecedent   // where, who, situation (time optional)
panel2  = B - Behavior     // observable action, how / how long / with what
panel3  = C - Consequence  // factual outcome or others' reaction right after B
panel4  = D - Emotion      // writer's own feeling only (emotion word)

────────────────────
YOUR TASK
────────────────────
1. Read the four lines.
2. Determine if this is a PROBLEMATIC or NORMAL situation:
   - PROBLEMATIC: scolding, crying, fighting, getting hurt, being embarrassed, etc.
   - NORMAL: playing, eating, studying, visiting places, etc.

3. Check each category (A, B, C, D) with TWO tests:

   • Required info present?
     – If essential details are absent or null, specify what is missing and give a short example.  
       (For A, do not flag missing time unless the scene is confusing without it.)

   • Category purity kept?
     – If the line contains data that belongs to another category, flag it:  
       "Non-A content in A (emotion included)"

   *Required sub-details*  
     A : place / people / background situation (time optional)
     B : concrete action, method‧duration‧tools  
     C : immediate factual result or a near-future plan that was directly agreed as a result of B or existing character's response (avoid introducing new characters)
     D : pure emotion word (intensity optional)

4. QUESTION FOCUS based on situation type:
   - PROBLEMATIC situations: Focus on "WHY" questions (causes, reasons)
   - NORMAL situations: Focus on "HOW" questions (methods, details)

5. If temporal or causal order is wrong, list which panels must move under 'Order'.

────────────────────
OUTPUT (exactly ONE UTF-8 JSON object)
────────────────────
{
  "situation_type": "problematic" or "normal",
  "A": ["…", "…"],   // issues & concrete add-ins for Antecedent ("" if none)
  "B": ["…", "…"],
  "C": ["…", "…"],
  "D": ["…", "…"],
  "Order": ["…"]     // panel-order problems ("" if none)
}

────────────────────
MANDATORY RULES
────────────────────
• Do NOT flag details already supplied in an earlier category.  
• Do NOT flag information obvious from context.  
• Write list items in natural Korean during real use.  
  (The examples below stay English for clarity only.)  
• Produce nothing except the single JSON block.

────────────────────
EXAMPLES
────────────────────

# Example 1
Input  
"panel1": "Minsoo and I performed a mackerel dissection show at school.",  
"panel2": null,  
"panel3": "I cut off the head, opened the belly and put the organs in a bag.",  
"panel4": null

Output  
{
  "situation_type": "normal",
  "A": ["background situation missing — e.g. 'during break time'"],
  "B": ["B missing — behavior is actually written in panel 3"],
  "C": [
    "Non-C content in C (behavior described)",
    "consequence missing — e.g. 'Minsoo laughed and said 'That's amazing'"
  ],
  "D": ["Emotion missing — e.g. 'I was happy'"],
  "Order": ["panel 2 and panel 3 should be swapped (Behavior - Consequence)"]
}

# Example 2 
Input  
"panel1": "I told Mom I wanted to visit an amusement park.",  
"panel2": "Mom said, 'Sure, let's go.'",  
"panel3": "We will go next Saturday and ride the roller-coaster.",  
"panel4": "I felt thrilled."

Output  
{
  "situation_type": "normal",
  "A": [
    "place missing — e.g. 'home'",
    "Non-A content in A (telling Mom is a behavior, which is B)"
  ],
  "B": [
    "Non-B content in B (Mom's reaction belongs to C)",
    "B missing — actual behavior is in panel 1"
  ],
  "C": [""],                    
  "D": [""],
  "Order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}

# Example 3 
Input  
"panel1": "I walked down the hallway at school.",  
"panel2": "Sohyun suddenly blocked my way and started crying.",  
"panel3": null,  
"panel4": "I felt nervous and sweaty."

{
  "situation_type": "problematic",
  "A": [""],
  "B": [
    "reason for crying missing — e.g. 'because I accidentally bumped her'"
  ],
  "C": [
    "C missing — e.g. 'Sohyun kept crying and wouldn't move'"
  ],
  "D": [""],
  "Order": [""]
}"""

        user_prompt = f"""Analyze Below Panels:
"panel1": "{panels_content.get('panel1', 'null')}",
"panel2": "{panels_content.get('panel2', 'null')}",
"panel3": "{panels_content.get('panel3', 'null')}",
"panel4": "{panels_content.get('panel4', 'null')}"
"""

        response = client.chat.completions.create(
            model="gpt-4.1-mini-2025-04-14",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.05,
            max_tokens=500
        )

        result = response.choices[0].message.content
        try:
            return json.loads(result)
        except json.JSONDecodeError:
            return {"A": [], "B": [], "C": [], "D": [], "Order": []}
    
    def _reconstruct_panel(self, answer: str, question: str, add_to_history: bool = True) -> None:
        """패널 재구성"""
        if not self.story_analysis:
            self.story_analysis = self._analyze_story_flow()
        
        journal = get_journal(self.db, self.journal_entry_id)
        if not journal:
            return
        
        client = openai.OpenAI()
        
        system_prompt = """You are a rewriting engine that fixes 4-panel diary drafts written in first-person Korean past tense based on the user's answer and analysis_result.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation 
- B (panel2): Behavior - observable action, how/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY when you fill the panels:
1. **ONLY use content from "panels_original" + "new_QA.answer"**
2. **NEVER use ANY content from "analysis_result"**
3. **NEVER invent new events, lines, or feelings**
4. **KEEP ALL content from "panels_original" - NEVER delete or remove existing content**

TRANSFORMATION RULES:
1. **When adding missing information:**
   • ONLY use information from user's answer (new_QA.answer)
   • If user mentioned place/time → add to panel1 (A)
   • If user mentioned behavior → add to panel2 (B)
   • If user mentioned consequence → add to panel3 (C)
   • If user mentioned emotion words → add to panel4 (D)
   • If user didn't provide specific information → leave panel as null

2. **analysis_result is ONLY for:**
   - Order changes (swapping panels as stated in Order)
   - Moving content to correct categories (A/B/C/D) if it's in wrong panel
   • Non-A content in A → move to appropriate panel ONLY if it exists in original
   • Non-B content in B → move to appropriate panel ONLY if it exists in original
   • Non-C content in C → move to appropriate panel ONLY if it exists in original
   • Non-D content in D → move to appropriate panel ONLY if it exists in original

3. **Each panel must contain only content appropriate for its category**
4. **Keep each panel to one Korean past-tense sentence, first-person diary style**

ABSOLUTELY FORBIDDEN - NEVER DO THESE:
- Using any text from analysis_result issues
- Creating content based on analysis_result suggestions
- Filling panels with analysis_result examples
- Using analysis_result to generate new content
- Copying any part of analysis_result into panels

Output exactly this JSON (nothing else, no line breaks inside values):

{
  "panel1": "...",
  "panel2": "...",
  "panel3": "...",
  "panel4": "..."
}

Write items in natural Korean during real use. (The examples below stay English for clarity only.)  

Here are the examples:
### Example 1
<panels_original>
"panel1": "Minsoo and I performed a mackerel dissection show at school.",  
"panel2": null,  
"panel3": "I cut off the head, opened the belly and put the organs in a bag.",  
"panel4": null
<new_QA>
question: "와! 고등어 해부 쇼라니 대박이다! 🐟 학교에서 언제 했어? 1) 쉬는 시간? 2) 점심시간?"
answer: "1"
<analysis_result>
{
  "A": ["background situation missing — e.g. 'during break time'"],
  "B": ["B missing — behavior is actually written in panel 3"],
  "C": ["Non-C content in C (behavior described)", "consequence missing — e.g. 'Minsoo laughed and said 'That's amazing'"],
  "D": ["Emotion missing — e.g. 'I was happy'"],
  "Order": ["panel 2 and panel 3 should be swapped (Behavior - Consequence)"]
}
<expected_output>
{
  "panel1": "Minsoo and I performed a mackerel dissection show at school in break time.",  
  "panel2": "I cut off the head, opened the belly and put the organs in a bag.",  
  "panel3": null,  
  "panel4": null
}

### Example 2 
<panels_original>
"panel1": "I told Mom I wanted to visit an amusement park.",  
"panel2": "Mom said, 'Sure, let's go.'",  
"panel3": "We will go next Saturday and ride the roller-coaster.",  
"panel4": "I felt thrilled."
<new_QA>
question: "롤러코스터라니 나도 떨린다! 😅 그럼 어머니랑 그 이야기는 어디서 했어? 1) 집에서? 2) 산책하다가?"
answer: "1"
<analysis_result>
{
  "A": [
    "place missing — e.g. 'home'",
    "Non-A content in A (telling Mom is a behavior, which is B)"
  ],
  "B": [
    "Non-B content in B (Mom's reaction belongs to C)",
    "B missing — actual behavior is in panel 1"
  ],
  "C": [""],                    
  "D": [""],
  "Order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}
<expected_output>
{
  "panel1": "I was at home with my mother.",  
  "panel2": "I told Mom I wanted to visit an amusement park.",  
  "panel3": "Mom said, 'Sure, let's go.' so we will go next Saturday and ride the roller-coaster.",  
  "panel4": "I felt thrilled."
}

### Example 3
<panels_original>
"panel1": "I walked down the hallway at school.",  
"panel2": "Sohyun suddenly blocked my way and started crying.",  
"panel3": null,  
"panel4": "I felt nervous and sweaty."
<new_QA>
question: "아이구.. 갑자기 나타나 울어서 당황스러웠겠다 😮 울기 전에 무슨 일이 있었어?"
answer: "내가 그냥 지나갔어."
<analysis_result>
{
"A": [""],
"B": [
    "reason for crying missing — e.g. 'because I accidentally bumped her'"
  ],
  "C": [
    "C missing — e.g. 'Sohyun kept crying and wouldn't move'"
  ],
  "D": [""],
  "Order": [""]
}
<expected_output>
{
  "panel1": "I walked down the hallway at school.",  
  "panel2": "Sohyun suddenly blocked my way and started crying because I just passed her.",  
  "panel3": null,  
  "panel4": "I felt nervous and sweaty."
}

<analysis_result>
{json.dumps(self.story_analysis, indent=2, ensure_ascii=False)}"""

        # comic_context가 있으면 그것을 사용, 없으면 revision_1 사용
        panels_original = journal.comic_context if journal.comic_context else journal.revision_1 or {}
        user_prompt = f"""<panels_original>
"panel1": "{panels_original.get('panel1', 'null')}",
"panel2": "{panels_original.get('panel2', 'null')}",
"panel3": "{panels_original.get('panel3', 'null')}",
"panel4": "{panels_original.get('panel4', 'null')}"
<new_QA>
question: "{question}"
answer: "{answer}"
"""

        response = client.chat.completions.create(
            model="gpt-4.1-mini-2025-04-14",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0,
            max_tokens=500
        )

        result = response.choices[0].message.content
        import json
        try:
            reconstructed_panels = json.loads(result)
            
            # Journal에 재구성된 데이터 저장
            update_journal_data(
                self.db, self.journal_entry_id,
                comic_context=reconstructed_panels
            )
            
            # 대화 기록 업데이트
            if add_to_history:
                self.comic_context_history.append({
                    "user": answer,
                    "bot": question
                })
                
        except json.JSONDecodeError:
            print("Failed to parse reconstruction response")
    
    def _get_next_question(self) -> str:
        """다음 질문 생성"""
        try:
            if not self.story_analysis:
                return "다음에 대해 말해줘!"
            
            # 문제점이 있는지 확인 (빈 문자열이 아닌 실제 문제가 있는지 체크)
            has_issues = [
                self.story_analysis.get("A", []),
                self.story_analysis.get("B", []),
                self.story_analysis.get("C", []),
                self.story_analysis.get("D", []),
                self.story_analysis.get("Order", [])
            ]
            
            # 각 카테고리에서 빈 문자열이 아닌 실제 문제가 있는지 확인
            has_real_issues = any(
                any(issue.strip() for issue in issues if issue.strip())
                for issues in has_issues
            )
            
            if not has_real_issues:
                # comic_context 완료 시 최종 만화 생성
                self._generate_final_comic_panels()
                update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision2)
                return "완성! 이제 수정하거나 추가하고 싶은 부분 있어? 🤔"
            
            # 대화 요약 생성
            conversation_summary = ""
            if self.comic_context_history:
                recent_conversations = self.comic_context_history[-4:]
                conversation_summary = "\nPrevious Q&A:\n" + "\n".join([
                    f"Q: {entry['bot']}\nA: {entry['user']}"
                    for entry in recent_conversations
                ])
            
            # 연속된 "모르겠어" 답변 확인
            dont_know_keywords = ["모르겠어", "기억 안 나", "잘 모르겠어", "모르겠다", "기억이 안 나", "잘 모르겠다", "몰라", "모르겠다고"]
            recent_answers = self.comic_context_history[-3:][::-1]  # 최근 3개 답변
            consecutive_dont_know_count = sum(
                1 for entry in recent_answers
                if any(keyword in entry['user'].lower() for keyword in dont_know_keywords)
            )
            
            client = openai.OpenAI()
            
            character_bg = self.get_character_background()
            system_prompt = f"""{character_bg}

**CRITICAL: You MUST follow the character background above in EVERY response!**

Your task: generate ONE follow-up question that fills the FIRST missing information gap listed in the analysis.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

=== Question-Generation Rules ===
1. Show a friendly reaction to the story.
2. **FIRST: Check situation_type from analysis_result:**
   - If "problematic": Focus on situational overview questions (context, timing, environment)
   - If "normal": Focus on "HOW" questions (methods, details)
3. **CRITICAL: Focus on the FIRST missing information in order: A → B → C → D → Order**
4. Ask exactly ONE question that can elicit the missing detail.
5. If possible, ask the question as a 2- or 3-choice prompt  
   (example: "1) … 2) … 3) …").  
   Use an open-ended question **only** if clear choices cannot be offered.
6. Avoid figurative language; keep sentences ≤ 15 syllables.
7. If the child likes topics in "affinity", you may embed them lightly to grab attention.
8. Avoid vague words like "그런 것", "이런 식으로", "그 때".
9. Do NOT repeat questions already asked.
10. Consider the entire conversation history and current panels when generating questions.
11. DO NOT ask about information that is:
    - Already stated in any panel
    - Already confirmed in previous Q&A
    - Can be inferred from existing information
12. When asking about emotions (panel 4), ask for explicit emotion words:
    - "기분이 어땠어?" → "기분이 어땠어? 1) 좋았어 2) 그냥 그랬어 3) 아쉬웠어?"
13. **PROBLEMATIC situations - CRITICAL RULES:**
    - NEVER ask direct "why"questions initially
    - ALWAYS start with situational overview questions
    - Ask about context: "그 때 뭘 하고 있었어?"
    - Ask about environment: "주변에 누가 있었어?", "어떤 상황이었어?"
    - Only after gathering context, then ask about causes
14. **NORMAL situations:**
    - Use "어떻게", "뭐로", "언제" (how-focused)
    - Example: "어떻게 놀았어?", "뭐로 그림을 그렸어?"

=== CRITICAL: Imagination Rule ===
15. **ONLY if EXACTLY 3+ consecutive "don't know" answers for the current category:**
    - **MUST** change approach to encourage imagination
    - Start with "그럼 상상해볼까?" or "아마도..." with emojis
    - Make it fun and creative rather than factual
    - Use phrases like "아마도", "상상해보면", "그랬을 것 같아"
    - Focus on what would be most likely or interesting
    - **ALWAYS** provide 2-3 imaginative choices
    - Example: "그럼 상상해보자! 😊 아마도 어떻게 됐을까? 1) ... 2) ... 3) ..."

16. **If LESS than 3 consecutive "don't know" answers:**
    - Continue with normal situational overview questions
    - Do NOT use imagination prompts
    - Focus on gathering more context and details

=== Output Format (JSON only) ===
{{
  "question": "question in Korean"
}}

- Write items in natural Korean during real use. (The examples below stay English for clarity only.)  
Here are the examples:
### Example 1
Input:
"panel1": "Minsoo and I performed a mackerel dissection show at school.",  
"panel2": null,  
"panel3": "I cut off the head, opened the belly and put the organs in a bag.",  
"panel4": null

analysis_result:
{{
  "situation_type": "normal",
  "A": ["background situation missing — e.g. 'during break time'"],
  "B": ["B missing — behavior is actually written in panel 3"],
  "C": ["Non-C content in C (behavior described)", "consequence missing — e.g. 'Minsoo laughed and said 'That's amazing'"],
  "D": ["Emotion missing — e.g. 'I was happy'"],
  "Order": ["panel 2 and panel 3 should be swapped (Behavior - Consequence)"]
}}

conversation_summary:

Output:
{{
"question": "대박대박! 너무 신기하다! 학교에서 어떤 상황에 했던 거야? 1) 쉬는 시간? 아니면 2) 점심시간?"
}}

### Example 2
Input:
"panel1": "I told Mom I wanted to visit an amusement park.",  
"panel2": "Mom said, 'Sure, let's go.'",  
"panel3": "We will go next Saturday and ride the roller-coaster.",  
"panel4": "I felt thrilled."

analysis_result:
{{
  "situation_type": "normal",
  "A": [
    "place missing — e.g. 'home'",
    "Non-A content in A (telling Mom is a behavior, which is B)"
  ],
  "B": [
    "Non-B content in B (Mom's reaction belongs to C)",
    "B missing — actual behavior is in panel 1"
  ],
  "C": [""],                    
  "D": [""],
  "Order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}}

conversation_summary:
Q: "놀이공원 너무 재미있겠다~! 가자고 하니 어머니께서는 뭐라고 말씀하셨어?"
A: "가자고 해서 우리 다음주 토요일에 가가지고 롤러코스터 탈거야."
Q: "우와~ 진짜 너무 좋겠다!! 기분이 어때?"
A: "완전 떨려"

Output:
{{
"question": "롤러코스터라니 나도 떨린다! 😅 그럼 어머니랑 그 이야기는 어디서 했어? 1) 집에서? 2) 산책하다가?"
}}

### Example 3
Input:
"panel1": "I walked down the hallway at school.",  
"panel2": "Sohyun suddenly blocked my way and started crying.",  
"panel3": null,  
"panel4": "I felt nervous and sweaty."

analysis_result:
{{
"situation_type": "problematic",
"A": [""],
"B": [
    "reason for crying missing — e.g. 'because I accidentally bumped her'"
  ],
  "C": [
    "C missing — e.g. 'Sohyun kept crying and wouldn't move'"
  ],
  "D": [""],
  "Order": [""]
}}

conversation_summary:
Q: "갑자기 나타났다니 당황스러웠겠다 😮 소현이는 갑자기 왜 운거야? 그 때 상황 기억나면 말해줘."
A: "모르겠어"
Q: "소현이가 울면서 뭔가 말했어? 🤨"
A: "몰라"
Q: "소현이 주위에 다른 사람이 있었어? 👫"
A: "모른다고"

Output:
{{
"question": "아이구.. 진짜 기억이 안 나는구나 😅 그럼 상상해보자! 소현이는 왜 운걸까? 1) 갑자기 다른 친구가 괴롭혔을까? 2) 선생님께 혼났을까? 3) 슬픈 일이 생각났을까?"
}}"""
            
            # chatbotFlow.ts와 동일한 방식으로 OpenAI API 호출하여 질문 생성
            
            # Create issue summary for the prompt
            issue_summary = ""
            for category in ["A", "B", "C", "D", "Order"]:
                issues = self.story_analysis.get(category, [])
                if issues and isinstance(issues, list) and any(issue.strip() for issue in issues):
                    issue_summary += f"\n{category} 문제:\n"
                    for issue in issues:
                        if issue.strip():
                            issue_summary += f"- {issue}\n"
            
            # Get current panel contents
            journal = get_journal(self.db, self.journal_entry_id)
            # comic_context가 있으면 그것을 사용, 없으면 revision_1 사용
            panels_content = journal.comic_context if journal and journal.comic_context else journal.revision_1 if journal and journal.revision_1 else {}
            
            user_prompt = f"""Current comic panels:
"panel1": "{panels_content.get('panel1', 'null')}",
"panel2": "{panels_content.get('panel2', 'null')}",
"panel3": "{panels_content.get('panel3', 'null')}",
"panel4": "{panels_content.get('panel4', 'null')}"

analysis_result:
{json.dumps(self.story_analysis, indent=2, ensure_ascii=False)}

conversation_summary:{conversation_summary}

issue_summary:{issue_summary}

consecutive_dont_know_count: {consecutive_dont_know_count}

Please generate a question that addresses the FIRST missing information gap."""

            try:
                response = client.chat.completions.create(
                    model="gpt-4.1-mini-2025-04-14",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.7,
                    max_tokens=200
                )

                result = response.choices[0].message.content
                question_data = json.loads(result)
                return generated_question
                
            except Exception as e:
                print(f"[DEBUG] comic_context: Error generating question: {e}")
                return "다음에 대해 말해줘!"
            
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in _get_next_question: {e}")
            return "다음에 대해 말해줘!"
    
    def _generate_first_question(self) -> str:
        """첫 번째 질문 생성"""
        try:
            question = self._get_next_question()
            return question
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in _generate_first_question: {e}")
            raise
    
    def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> Any:
        """현재 단계의 interaction turn 가져오기 또는 생성"""
        from .database.crud.chatbot import get_latest_interaction_turn
        
        latest_turn = get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            return create_interaction_turn(self.db, self.journal_entry_id, stage)
    
    def is_complete(self) -> bool:
        """분석이 완료되었는지 확인"""
        if not self.story_analysis:
            return False
        
        # 문제점이 있는지 확인 (빈 문자열이 아닌 실제 문제가 있는지 체크)
        has_issues = [
            self.story_analysis.get("A", []),
            self.story_analysis.get("B", []),
            self.story_analysis.get("C", []),
            self.story_analysis.get("D", []),
            self.story_analysis.get("Order", [])
        ]
        
        # 각 카테고리에서 빈 문자열이 아닌 실제 문제가 있는지 확인
        has_real_issues = any(
            any(issue.strip() for issue in issues if issue.strip())
            for issues in has_issues
        )
        
        is_complete = not has_real_issues
        
        # 완료되었고 아직 최종 만화 패널이 생성되지 않았다면 생성
        if is_complete:
            self._generate_final_comic_panels()
        
        return is_complete
    
    def _generate_initial_comic_panels(self) -> None:
        """comic_context 시작 시 초기 만화 패널 생성 및 Comic 테이블에 저장"""
        try:
            
            # revision_1 데이터 가져오기
            journal = get_journal(self.db, self.journal_entry_id)
            if not journal or not journal.revision_1:
                return
            
            # 패널 내용 추출 (Null은 빈 문자열로 처리)
            panel_contents = {
                "panel1": journal.revision_1.get("panel1", "") if journal.revision_1.get("panel1") != "null" else "",
                "panel2": journal.revision_1.get("panel2", "") if journal.revision_1.get("panel2") != "null" else "",
                "panel3": journal.revision_1.get("panel3", "") if journal.revision_1.get("panel3") != "null" else "",
                "panel4": journal.revision_1.get("panel4", "") if journal.revision_1.get("panel4") != "null" else ""
            }
            
            
            # ComicGridGenerator로 만화 생성
            from .utils.comic_grid_generator import ComicGridGenerator
            generator = ComicGridGenerator()
            comic_data = generator.generate_comic_grids(panel_contents)
            
            # Comic 테이블에 저장 (first_panel1~4에 저장)
            update_comic_data(
                self.db, self.journal_entry_id,
                first_panel1=comic_data.get("panel1"),
                first_panel2=comic_data.get("panel2"),
                first_panel3=comic_data.get("panel3"),
                first_panel4=comic_data.get("panel4")
            )
            
            
        except Exception as e:
            print(f"[DEBUG] comic_context: Error generating initial comic panels: {e}")
            import traceback
            traceback.print_exc()
    
    def _generate_final_comic_panels(self) -> None:
        """comic_context 완료 시 최종 만화 패널 생성 및 Comic 테이블에 저장"""
        try:
            # comic_context 데이터 가져오기
            journal = get_journal(self.db, self.journal_entry_id)
            if not journal or not journal.comic_context:
                return
            
            # 패널 내용 추출 (Null은 빈 문자열로 처리)
            panel_contents = {
                "panel1": journal.comic_context.get("panel1", "") if journal.comic_context.get("panel1") != "null" else "",
                "panel2": journal.comic_context.get("panel2", "") if journal.comic_context.get("panel2") != "null" else "",
                "panel3": journal.comic_context.get("panel3", "") if journal.comic_context.get("panel3") != "null" else "",
                "panel4": journal.comic_context.get("panel4", "") if journal.comic_context.get("panel4") != "null" else ""
            }
            
            
            # ComicGridGenerator로 만화 생성
            from .utils.comic_grid_generator import ComicGridGenerator
            generator = ComicGridGenerator()
            comic_data = generator.generate_comic_grids(panel_contents)
            
            
            # Comic 테이블에 저장 (second_panel1~4에 저장)
            update_comic_data(
                self.db, self.journal_entry_id,
                second_panel1=comic_data.get("panel1"),
                second_panel2=comic_data.get("panel2"),
                second_panel3=comic_data.get("panel3"),
                second_panel4=comic_data.get("panel4")
            )
            
        except Exception as e:
            print(f"[DEBUG] comic_context: Error generating final comic panels: {e}")
            import traceback
            traceback.print_exc() 

 