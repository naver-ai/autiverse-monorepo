from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
import asyncio
import json
import sys

# Shared character background and conversation rules
CHARACTER_BACKGROUND = """
[Character Background]
You are a 15-year-old Korean middle school student named Dodo (도도).
You're having a friendly conversation with your autistic best friend, Yuchan (유찬, also 15, male).

Yuchan's special interests:
- Dinosaurs
- Counting things
- Talking to himself

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

@dataclass
class ComicPanel:
    """Comic panel data structure"""
    content: Optional[str]
    missing_content: Optional[str] = None

class ComicContextGenerator:
    def __init__(self, input_json: str, temperature: float = 0.1, model: str = "gpt-4.1-mini-2025-04-14"):
        self.llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            openai_api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.panels = self._parse_input_json(input_json)
        self.conversation_history = []  # List of (panel_number, question, answer) tuples
        self.story_analysis = None  # Initialize story_analysis as None

    def _parse_input_json(self, input_json: str) -> Dict[str, ComicPanel]:
        """Parse input JSON and create ComicPanel objects"""
        if isinstance(input_json, str):
            panels_dict = json.loads(input_json)
        else:
            panels_dict = input_json

        panels = {}
        for key, value in panels_dict.items():
            if isinstance(value, dict):
                # Handle new format with content and missing_content
                content = value.get("content")
                missing_content = value.get("missing_content")
                panels[key] = ComicPanel(content=content, missing_content=missing_content)
            elif isinstance(value, str):
                # Handle old format for backward compatibility
                if value.startswith("null"):
                    # Extract missing content from parentheses
                    missing_content = value[value.find("(")+1:value.find(")")]
                    panels[key] = ComicPanel(content=None, missing_content=missing_content)
                else:
                    panels[key] = ComicPanel(content=value)
        return panels

    def is_complete(self) -> bool:
        """Check if all panels have content"""
        return all(
            panel.content is not None 
            for panel in self.panels.values()
        )

    def get_remaining_panels(self) -> List[str]:
        """Get list of panel numbers that still need content"""
        return [
            panel_key 
            for panel_key, panel in self.panels.items() 
            if panel.content is None
        ]

    async def analyze_story_flow(self) -> Dict[str, Any]:
        """Analyze if the 4-panel comic tells a complete story"""
        panels_content = {
            key: panel.content if panel.content else None
            for key, panel in self.panels.items()
        }

        system_prompt = """
        You are "ABCD-Diary Reviewer."

────────────────────
INPUT (always 4 lines)
────────────────────
panel1  = A - Antecedent   // where, who, situation (time is optional)
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
}

        """

        user_prompt = f"""Analyze Below Panels:
        "panel1": "{panels_content['panel1'] if panels_content['panel1'] else 'null'}",
        "panel2": "{panels_content['panel2'] if panels_content['panel2'] else 'null'}",
        "panel3": "{panels_content['panel3'] if panels_content['panel3'] else 'null'}",
        "panel4": "{panels_content['panel4'] if panels_content['panel4'] else 'null'}"
        """

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

        response = await self.llm.ainvoke(messages)
        try:
            result = json.loads(response.content)
            return result
        except json.JSONDecodeError:
            return {
                "Content": [],
                "Order": []
            }

    def _display_analysis_status(self, analysis: Dict[str, Any]) -> None:
        """Display the current status of the story based on analysis results"""
        print("\n=== Current Status ===")
        
        # Display any flow issues
        if analysis.get("flow_issues"):
            print("\nFlow Issues:")
            for issue in analysis["flow_issues"]:
                print(f"   - {issue}")
        
        # Check if story is complete
        is_complete = (
            not analysis.get("flow_issues") and 
            analysis.get("panel_order_ok")
        )
        
        if is_complete:
            print("\n🎉 Congratulations! The story is complete!")

    async def _call_gpt(self, role: str, prompt: str) -> str:
        """Helper method to make GPT calls with consistent format"""
        messages = [
            SystemMessage(content=role),
            HumanMessage(content=prompt)
        ]
        response = await self.llm.ainvoke(messages)
        return response.content.strip()

    async def reconstruct_panel(self, answer: str, question: str) -> None:
        """Reconstruct panels based on new information to tell a coherent story.
        
        Args:
            answer: User's answer to the question
            question: The question that was asked
        """
        if not self.story_analysis:
            self.story_analysis = await self.analyze_story_flow()

        system_prompt = """You are a rewriting engine that fixes 4-panel diary drafts written in first-person Korean past tense based on the user's answer and analysis_result.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

TRANSFORMATION RULES
1. NEVER invent new events, lines, or feelings. ONLY use text from "panels_original" + EXACT words from "new_QA.answer".
2. Treat null/None as an empty panel. When you fill an empty panel, reuse only existing material (no duplication).
3. Obey every instruction in analysis_result.Order (swap panels as stated).
4. From analysis_result, ONLY fix issues that can be solved by rewriting using EXACT words from user's answer:
   • Missing A info → ONLY add if user explicitly mentioned place/time in answer
   • Missing B info → ONLY add if user explicitly mentioned behavior in answer  
   • Missing C info → ONLY add if user explicitly mentioned consequence in answer
   • Missing D info → ONLY add if user explicitly mentioned emotion words in answer
   • Non-A content in A → move to appropriate panel ONLY if it exists in original
   • Non-B content in B → move to appropriate panel ONLY if it exists in original
   • Non-C content in C → move to appropriate panel ONLY if it exists in original
   • Non-D content in D → move to appropriate panel ONLY if it exists in original
5. Each panel must contain only content appropriate for its category.
6. Keep each panel to one Korean past-tense sentence, first-person diary style.
7. When filling empty panels:
   - DO NOT repeat information already stated in other panels
   - DO NOT generate new content
   - ONLY use EXACT words from user's answer
   - If user's answer doesn't contain relevant information, leave panel as null
8. If user's answer doesn't contain clear emotion words, leave panel 4 as null
9. NEVER add details like time, place, duration, or reactions unless user explicitly mentioned them
10. Output exactly this JSON (nothing else, no line breaks inside values):

{{
  "panel1": "...",
  "panel2": "...",
  "panel3": "...",
  "panel4": "..."
}}

9. Write items in natural Korean during real use. (The examples below stay English for clarity only.)  

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
{{
  "A": ["background situation missing — e.g. 'during break time'"],
  "B": ["B missing — behavior is actually written in panel 3"],
  "C": ["Non-C content in C (behavior described)", "consequence missing — e.g. 'Minsoo laughed and said 'That's amazing'"],
  "D": ["Emotion missing — e.g. 'I was happy'"],
  "Order": ["panel 2 and panel 3 should be swapped (Behavior - Consequence)"]
}}
<expected_output>
{{
  "panel1": "Minsoo and I performed a mackerel dissection show at school in break time.",  
  "panel2": "I cut off the head, opened the belly and put the organs in a bag.",  
  "panel3": null,  
  "panel4": null
}}

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
{{
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
<expected_output>
{{
  "panel1": "I was at home with my mother.",  
  "panel2": "I told Mom I wanted to visit an amusement park.",  
  "panel3": "Mom said, 'Sure, let's go.' so we will go next Saturday and ride the roller-coaster.",  
  "panel4": "I felt thrilled."
}}

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
{{
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
<expected_output>
{{
  "panel1": "I walked down the hallway at school.",  
  "panel2": "Sohyun suddenly blocked my way and started crying because I just passed her.",  
  "panel3": null,  
  "panel4": "I felt nervous and sweaty."
}}
"""

        user_prompt = f"""<panels_original>
"panel1": "{self.panels['panel1'].content if self.panels['panel1'].content else 'null'}",
"panel2": "{self.panels['panel2'].content if self.panels['panel2'].content else 'null'}",
"panel3": "{self.panels['panel3'].content if self.panels['panel3'].content else 'null'}",
"panel4": "{self.panels['panel4'].content if self.panels['panel4'].content else 'null'}"
</panels_original>

<new_QA>
question: {question}
answer: {answer}
</new_QA>

<analysis_result>
{json.dumps(self.story_analysis, ensure_ascii=False)}
</analysis_result>"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = await self.llm.ainvoke(messages)
        try:
            new_panels = json.loads(response.content)
            
            # Update all panels with new content
            for key, content in new_panels.items():
                if content == "null":
                    self.panels[key] = ComicPanel(content=None)
                else:
                    self.panels[key] = ComicPanel(content=content)
            
            # Print current status after reconstruction
            print("\n=== 현재 패널 ===")
            for i in range(1, 5):
                panel = self.panels[f"panel{i}"]
                if panel.content:
                    print(f"패널 {i}: {panel.content}")
                else:
                    print(f"패널 {i}: null")
                    
        except json.JSONDecodeError:
            print("오류: 패널 재구성에 실패했습니다")

    async def get_next_question(self) -> Optional[str]:
        """Generate the next question based on essential missing information.
        
        Returns:
            Question string or None if story is complete.
        """
        if not self.story_analysis:
            return None

        # Check if there are any issues in A, B, C, D categories
        has_issues = any([
            bool(self.story_analysis.get("A") and any(issue.strip() for issue in self.story_analysis.get("A", []))),
            bool(self.story_analysis.get("B") and any(issue.strip() for issue in self.story_analysis.get("B", []))),
            bool(self.story_analysis.get("C") and any(issue.strip() for issue in self.story_analysis.get("C", []))),
            bool(self.story_analysis.get("D") and any(issue.strip() for issue in self.story_analysis.get("D", []))),
            bool(self.story_analysis.get("Order") and any(issue.strip() for issue in self.story_analysis.get("Order", [])))
        ])
        
        if not has_issues:
            return None

        # Create conversation summary
        conversation_summary = ""
        if self.conversation_history:
            conversation_summary = "\nPrevious Q&A:\n" + "\n".join(
                f"Q: {q}\nA: {a}" for _, q, a in self.conversation_history
            )

        system_prompt = f"""
        {CHARACTER_BACKGROUND}

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
   - If "normal": Focus on "HOW" questions (methods, details, processes)
3. Focus on the FIRST missing information in order: A → B → C → D → Order
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
15. **Before generating a question, analyze the conversation history:**
    - Look at recent Q&A pairs (last 3-4 exchanges)
    - Check if the questions were about the same category as current_category
    - Count consecutive "don't know" type answers for that category
    - "Don't know" keywords: "모르겠어", "기억 안 나", "잘 모르겠어", "모르겠다", "기억이 안 나", "잘 모르겠다", "몰라", "모르겠다고"
    
16. **ONLY if EXACTLY 3+ consecutive "don't know" answers for the current category:**
    - **MUST** change approach to encourage imagination
    - Start with "그럼 상상해볼까?" or "아마도..." with emojis
    - Make it fun and creative rather than factual
    - Use phrases like "아마도", "상상해보면", "그랬을 것 같아"
    - Focus on what would be most likely or interesting
    - **ALWAYS** provide 2-3 imaginative choices
    - Example: "그럼 상상해보자! 😊 아마도 어떻게 됐을까? 1) ... 2) ... 3) ..."

17. **If LESS than 3 consecutive "don't know" answers:**
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
}}
"""

        # Create issue summary for the prompt
        issue_summary = ""
        for category in ["A", "B", "C", "D", "Order"]:
            issues = self.story_analysis.get(category, [])
            if issues and any(issue.strip() for issue in issues):
                issue_summary += f"\n{category} 문제:\n"
                for issue in issues:
                    if issue.strip():
                        issue_summary += f"- {issue}\n"

        user_prompt = f"""Current Panels:
        "panel1": "{self.panels['panel1'].content if self.panels['panel1'].content else 'null'}",
        "panel2": "{self.panels['panel2'].content if self.panels['panel2'].content else 'null'}",
        "panel3": "{self.panels['panel3'].content if self.panels['panel3'].content else 'null'}",
        "panel4": "{self.panels['panel4'].content if self.panels['panel4'].content else 'null'}"

analysis_result:
{json.dumps(self.story_analysis, ensure_ascii=False, indent=2)}

{conversation_summary}"""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]

        response = await self.llm.ainvoke(messages)
        try:
            result = json.loads(response.content)
            return result["question"]
        except (json.JSONDecodeError, KeyError):
            return None

    def get_final_result(self) -> Dict[str, str]:
        """Return the final comic panel contents in Korean format.
        
        Returns:
            Dict containing the final content of each panel:
            {
                "panel1": "패널 1 내용",
                "panel2": "패널 2 내용",
                "panel3": "패널 3 내용",
                "panel4": "패널 4 내용"
            }
            
            If a panel is empty, its content will be "null"
        """
        result = {}
        for i in range(1, 5):
            panel_key = f"panel{i}"
            panel = self.panels.get(panel_key)
            if panel and panel.content:
                result[panel_key] = panel.content
            else:
                result[panel_key] = "null"
        
        # Print final result in Korean
        print("\n=== 최종 4컷 만화 ===")
        for i in range(1, 5):
            panel_key = f"panel{i}"
            print(f"패널 {i}: {result[panel_key]}")
        print("\n수고했어! 재미있는 만화일기가 완성됐네! 👋")
        
        return result

async def run_comic_conversation(input_json: str):
    # Set up proper encoding for input/output
    if sys.platform == 'win32':
        sys.stdin.reconfigure(encoding='utf-8')
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        # For Unix-like systems (macOS, Linux)
        import io
        sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    generator = ComicContextGenerator(input_json)
    
    while True:
        # 1. Analyze current story state
        print("Analyzing story flow...")
        generator.story_analysis = await generator.analyze_story_flow()
        
        # 2. Check if there are any content issues or missing information
        has_content_issues = any([
            bool(generator.story_analysis.get("A") and any(issue.strip() for issue in generator.story_analysis.get("A", []))),
            bool(generator.story_analysis.get("B") and any(issue.strip() for issue in generator.story_analysis.get("B", []))),
            bool(generator.story_analysis.get("C") and any(issue.strip() for issue in generator.story_analysis.get("C", []))),
            bool(generator.story_analysis.get("D") and any(issue.strip() for issue in generator.story_analysis.get("D", [])))
        ])
        has_order_issues = bool(generator.story_analysis.get("Order") and any(issue.strip() for issue in generator.story_analysis.get("Order", [])))
        
        # 3. If there are issues or missing information, continue asking questions
        if has_content_issues or has_order_issues:
            print("\n=== 현재 상태 ===\n")
            
            if has_content_issues:
                print("내용 문제:")
                for category in ["A", "B", "C", "D"]:
                    issues = generator.story_analysis.get(category, [])
                    if issues and any(issue.strip() for issue in issues):
                        print(f"  {category} (패널 {['1', '2', '3', '4'][['A', 'B', 'C', 'D'].index(category)]}):")
                        for issue in issues:
                            if issue.strip():
                                print(f"    - {issue}")
            
            if has_order_issues:
                print("\n순서 문제:")
                for issue in generator.story_analysis.get("Order", []):
                    if issue.strip():
                        print(f"- {issue}")
            
            # Get next question based on analysis
            next_question = await generator.get_next_question()
            if not next_question:
                # If no question is generated, analyze story flow again
                continue
            
            print(f"\n친구: {next_question}")
            user_response = input("유찬: ")
            
            # Add to conversation history
            generator.conversation_history.append((len(generator.conversation_history) + 1, next_question, user_response))
            
            # Reconstruct panels based on user response
            await generator.reconstruct_panel(user_response, next_question)
            
        else:
            # Check if all panels are filled and no issues remain
            filled_panels = sum(1 for panel in generator.panels.values() if panel.content is not None)
            if filled_panels >= 3:
                # Only end if all panels are filled and no issues remain
                break
    
    print("\n=== 최종 4컷 만화 ===")
    for i in range(1, 5):
        panel = generator.panels.get(f"panel{i}")
        print(f"패널 {i}: {panel.content if panel and panel.content else 'null'}")
    
    print("\n수고했어! 재미있는 만화일기가 완성됐네! 👋")

if __name__ == "__main__":
    # Example input JSON
    example_input = {
        # "panel1": {"content": "나는 엄마랑 집 근처에서 산책했다", "missing_content": None },
        # "panel2": {"content": None, "missing_content": "산책 중에 어쩌다 엄마와 어떤 특정 이야기를 나누었는지 모르기 때문" },
        # "panel3": {"content": "나는 엄마와 놀이공원에 가고 싶은 이야기를 했다", "missing_content": None },
        # "panel4": {"content": None, "missing_content": "감정 표현 필요" }

        # "panel1": {"content": "나는 영호랑 줄넘기를 하고 놀았다.", "missing_content": None },
        # "panel2": {"content": None, "missing_content": "어떤 일이 있었는지 알 수 없음" },
        # "panel3": {"content": "점프도 하고 줄도 돌렸다.", "missing_content": None },
        # "panel4": {"content": None, "missing_content": None }

        # "panel1": { "content": "민수가 오늘 나랑 안 놀아줬다", "missing_content": None },
        # "panel2": { "content": None, "missing_content": "민수가 왜 안 놀아줬는지 알 수 없음" },
        # "panel3": { "content": "민수가 나를 괴롭혔다", "missing_content": None },
        # "panel4": { "content": None, "missing_content": "기분을 이야기하지 않음" }

        "panel1": { "content": "나는 학교에서 길을 가고 있었다", "missing_content": None },
        "panel2": { "content": None, "missing_content": "선생님이 왜 혼냈는지 알 수 없음" },
        "panel3": { "content": "선생님이 나를 혼냈다", "missing_content": None },
        "panel4": { "content": None, "missing_content": "기분을 이야기하지 않음" }

    }
    asyncio.run(run_comic_conversation(example_input))





    