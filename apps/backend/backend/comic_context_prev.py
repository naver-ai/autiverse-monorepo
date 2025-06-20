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
    def __init__(self, input_json: str):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
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
        You are an expert analyst who reviews a 4-panel diary drafts written by autistic teenager. 
        
        Your job:
        1. Read the four panels (panel1-4).  
        2. Identify missing or unclear information that makes the story hard to understand in details ("Content" problems). 
        - Typical issues: 
          • if there's a clear gap in cause-effect or awkward flow, specify the exact point (MANDATORY)
          • if these are truly unclear, specify what exactly is unclear (MANDATORY)
          • if panel 4 has no emotion, "Panel 4에 감정이 드러나지 않음" (MANDATORY)
          • if panel 4 has non-emotional content, "Panel 4에 감정 외 내용 포함" (MANDATORY)
        3. Check temporal / causal order ("Order" problems).  
        - If panels should be rearranged, state which and why.  
        4. Return exactly one JSON in UTF-8 without extra keys:
        {{
            "Content": ["…", "…"],   // list; put "" if no issues
            "Order":   ["…", "…"]    // list; put "" if no issues
        }}
        Write the feedback in natural Korean, but keep panel labels in English (panel 1, panel 2 …).  
        Do NOT change the original sentences or add explanations outside the JSON.

        IMPORTANT RULES:
        1. If a detail is already explained in previous panels, do NOT mark it as missing.
        2. If a detail is implied by context, do NOT mark it as missing.
        3. Only mark something as missing if it's truly unclear or contradictory.
        4. Panel 4 MUST contain emotion. If there's no emotion in panel 4, ALWAYS mark it as "Panel 4에 감정이 드러나지 않음".
        5. When describing missing information, use existing information to be more specific:
           - Instead of "어떤 일이 있었는지 알 수 없음"
           - Use "누구와/어디서/무엇을 했는지 구체적으로" (using known information)
           - Example: "민수와 어떤 식으로 고등어 해체쇼를 했는지 알 수 없음"

        Here is the examples:
        ### Example 1
        Input:
        "panel1": "나는 민수랑 학교에서 고등어 해체쇼를 했다.",
        "panel2": null,
        "panel3": "고등어 머리를 자르고 배를 가르고 내장을 꺼내서 비닐에 넣었다.",
        "panel4": null

        Output:
        {{
        "Content": ["학교에서 고등어 해체쇼를 어떻게 했는지 알 수 없음. 필통 같은 것을 고등어로 빗대어 표현한 것인지 확인 필요", "Panel 4에 감정이 드러나지 않음"],
        "Order":   [""]
        }}

        ### Example 2
        Input:
        "panel1": "소현이가 울었다.",
        "panel2": "소현이가 내 앞을 가로막았다.",
        "panel3": "나는 학교에서 길을 걷고 있었다.",
        "panel4": "나는 땀을 닦고 당황스러워했다."

        Output:
        {{
        "Content": ["소현이가 앞을 가로막았을 때 어떻게 했길래 울었는지 알 수 없음", "Panel 4에 감정 외 내용 포함"],
        "Order":   ["panel 1, panel 3의 순서가 바뀌어야함"]
        }}

        ### Example 3
        Input:
        "panel1": "나는 복도에서 뛰어다녔다.",
        "panel2": "선생님이 그걸 보셨다.",
        "panel3": "그래서 나를 혼내셨다.",
        "panel4": "나는 부끄러웠다."

        Output:
        {{
        "Content": [""],
        "Order":   [""]
        }}
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

        system_prompt = f"""You are a rewriting engine that fixes 4-panel diary drafts written in first-person Korean past tense based on the user's answer and analysis_result.

TRANSFORMATION RULES
1. Never invent new events, lines, or feelings. Allowed material = text in "panels_original" + "new_QA.answer".
2. Treat null/None as an empty panel. When you fill an empty panel, reuse only existing material (no duplication).
3. Obey every instruction in analysis_result.Order (swap panels as stated).
4. From analysis_result.Content, directly fix any issue that can be solved by rewriting:
   • "Panel 4 lacks emotion" → leave only an emotion in panel 4 and move the rest to panel 3.
   • "Unclear if it was real or pretend" → clarify using new_QA.answer.
   Skip issues that require user input.
5. Panel 4 must contain one short emotion sentence only.
6. Keep each panel to one Korean past-tense sentence, first-person diary style.
7. When filling empty panels:
   - DO NOT repeat information already stated in other panels
   - DO NOT generate new content
   - Only use information from the answer if it directly relates to the empty panel
8. Output exactly this JSON (nothing else, no line breaks inside values):

{{
  "panel1": "...",
  "panel2": "...",
  "panel3": "...",
  "panel4": "..."
}}

Here is the examples:
### Example 1
<panels_original>
"panel1": "나는 민수랑 학교에서 고등어 해체쇼를 했다.",
"panel2": null,
"panel3": "고등어 머리를 자르고 배를 가르고 내장을 꺼내서 비닐에 넣었다.",
"panel4": null
<new_QA>
question: "대박대박! 너무 신기하다! 1) 학교에 진짜 고등어가 있었던 거야? 2) 필통 같은 걸로 고등어처럼 연극했어?"
answer: "2"
<analysis_result>
Content: ["학교에서 고등어 해체쇼를 어떻게 했는지 알 수 없음. 필통 같은 것을 고등어로 빗대어 표현한 것인지 확인 필요", "Panel 4에 감정이 드러나지 않음"]
Order: [""]
<expected_output>
{{
  "panel1": "나는 민수랑 학교에서 필통을 가지고 고등어 해체쇼를 했다.",
  "panel2": null,
  "panel3": "고등어 머리를 자르고 배를 가르고 내장을 꺼내서 비닐에 넣었다.",
  "panel4": null
}}

### Example 2
<panels_original>
"panel1": "소현이가 울었다.",
"panel2": "소현이가 내 앞을 가로막았다.",
"panel3": "나는 학교에서 길을 걷고 있었다.",
"panel4": "나는 소현이를 바라보며 당황스러워했다."
<new_QA>
question: "소현이가 앞을 가로막아서 진짜 당황스러웠겠네! 그래서 어떻게 했어? 1) 비켜달라고 했어? 2) 아니면 밀치고 지나갔어?"
answer: "2"
<analysis_result>
"Content": ["소현이가 앞을 가로막았을 때 어떻게 했길래 울었는지 알 수 없음", "Panel 4에 감정 외 내용 포함"]
"Order": ["panel 1, panel 3의 순서가 바뀌어야함"]
<expected_output>
{{
"panel1": "나는 학교에서 길을 걷고 있었다.",
"panel2": "소현이가 내 앞을 가로막길래 밀치고 지나갔다",
"panel3": "그랬더니 소현이가 울어서 나는 소현이를 바라보았다.",
"panel4": "나는 당황스러웠다."
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
        if not self.story_analysis or not self.story_analysis.get("Content"):
            return None

        # Create conversation summary
        conversation_summary = ""
        if self.conversation_history:
            conversation_summary = "\nPrevious Q&A:\n" + "\n".join(
                f"Q: {q}\nA: {a}" for _, q, a in self.conversation_history  # Show all Q&A pairs
            )

        system_prompt = f"""You are role-playing Dodo (도도), a 15-year-old Korean middle-schooler.
Your task: generate ONE follow-up question that fills the FIRST "Content" gap listed in "content_feedback".

=== Question-Generation Rules ===
1. Show a friendly reaction to the story.
2. Then, focus ONLY on the first content gap in the list and write exactly ONE question that can elicit the missing detail.
3. Whenever possible, ask the question as a 2- or 3-choice prompt  
   (예: "A였어, B였어?" 또는 "1) … 2) … 3) …").  
   Use an open-ended question **only** if clear choices cannot be offered.
4. Avoid figurative language; keep sentences ≤ 15 syllables.
5. If the child likes topics in "affinity", you may embed them lightly to grab attention.
6. Avoid vague words like "그런 것", "이런 식으로", "그 때".
7. Do NOT repeat questions already asked.
8. Consider the entire conversation history and current panels when generating questions.
9. DO NOT ask about information that is:
   - Already stated in any panel (예: "민수랑 했다"가 이미 있으면 "누구랑 했어?, "혼자 했어?"라고 묻지 않기)
   - Already confirmed in previous Q&A
   - Can be inferred from existing information
10. Before generating a question:
    - Carefully check ALL panels for existing information
    - Check ALL previous Q&A for confirmed information
    - Make sure the question is about something truly missing
11. Return exactly one JSON:  
    {{ 
      "question": "single question in Korean"
    }}

{CHARACTER_BACKGROUND}

=== Output Format (JSON only) ===
{{
  "question": "question in Korean"
}}

Here is the examples:
        ### Example 1
        Input:
        "panel1": "나는 민수랑 학교에서 필통을 가지고 고등어 해체쇼를 했다.",
        "panel2": null,
        "panel3": "고등어 머리를 자르고 배를 가르고 내장을 꺼내서 비닐에 넣었다.",
        "panel4": null

        content_feedback: ["Panel 4에 감정이 드러나지 않음"]

        conversation_summary:
        Q: "대박대박! 너무 신기하다! 1) 학교에 진짜 고등어가 있었던 거야? 2) 고등어처럼 연극했어?"
        A: "2"
        Q: "어떤 걸 가지고 고등어처럼 해체한거야?"
        A: "필통"
        
        Output:
        {{
        "question": "필통으로 재미있게 했구나! 기분이 어땠어?"
        }}


        ### Example 2
        Input:
        "panel1": "나는 학교에서 길을 걷고 있었다.",
        "panel2": null,
        "panel3": "소현이가 내 앞을 가로막았다.",
        "panel4": null

        content_feedback: ["소현이가 앞을 가로막았을 때 어떻게 했길래 울었는지 알 수 없음", "Panel 4에 감정이 드러나지 않음"]

        conversation_summary:

        Output:
        {{
        "question": "소현이가 앞을 가로막았을 때 어떻게 했어? 1) 비켜달라고 했어? 2) 아니면 밀치고 지나갔어?"
        }}


"""

        user_prompt = f"""Current Panels:
        "panel1": "{self.panels['panel1'].content if self.panels['panel1'].content else 'null'}",
        "panel2": "{self.panels['panel2'].content if self.panels['panel2'].content else 'null'}",
        "panel3": "{self.panels['panel3'].content if self.panels['panel3'].content else 'null'}",
        "panel4": "{self.panels['panel4'].content if self.panels['panel4'].content else 'null'}"

content_feedback:
{chr(10).join(f"- {issue}" for issue in self.story_analysis.get("Content", []))}

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
        has_content_issues = bool(generator.story_analysis.get("Content"))
        has_order_issues = bool(generator.story_analysis.get("Order"))
        
        # 3. If there are issues or missing information, continue asking questions
        if has_content_issues or has_order_issues:
            print("\n=== 현재 상태 ===\n")
            
            if has_content_issues:
                print("내용 문제:")
                for issue in generator.story_analysis["Content"]:
                    print(f"- {issue}")
            
            if has_order_issues:
                print("\n순서 문제:")
                for issue in generator.story_analysis["Order"]:
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
            
            print("\n=== 현재 패널 ===")
            for i in range(1, 5):
                panel = generator.panels.get(f"panel{i}")
                print(f"패널 {i}: {panel.content if panel and panel.content else 'null'}")
            print()
        else:
            # Check if all panels are filled and no issues remain
            filled_panels = sum(1 for panel in generator.panels.values() if panel.content is not None)
            if filled_panels >= 3 and not has_content_issues and not has_order_issues:
                # Only end if all panels are filled and no issues remain
                break
            
            # If there are still empty panels or issues, get next question
            next_question = await generator.get_next_question()
            if not next_question:
                continue
            
            print(f"\n친구: {next_question}")
            user_response = input("유찬: ")
            
            # Add to conversation history
            generator.conversation_history.append((len(generator.conversation_history) + 1, next_question, user_response))
            
            # Reconstruct panels based on user response
            await generator.reconstruct_panel(user_response, next_question)
            
            print("\n=== 현재 패널 ===")
            for i in range(1, 5):
                panel = generator.panels.get(f"panel{i}")
                print(f"패널 {i}: {panel.content if panel and panel.content else 'null'}")
            print()
    
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

        "panel1": { "content": "나는 길을 가고 있었다", "missing_content": None },
        "panel2": { "content": None, "missing_content": "선생님이 왜 혼냈는지 알 수 없음" },
        "panel3": { "content": "선생님이 나를 혼냈다", "missing_content": None },
        "panel4": { "content": None, "missing_content": "기분을 이야기하지 않음" }

    }
    asyncio.run(run_comic_conversation(example_input))





    