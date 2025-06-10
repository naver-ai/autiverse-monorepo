from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
import asyncio
import json
import sys

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
            if isinstance(value, str):
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
            key: panel.content if panel.content else "(empty)"
            for key, panel in self.panels.items()
        }

        prompt = f"""You are analyzing a 4-panel comic diary. This is a simple diary format that just needs:
        - A situation or event (panels 1-3)
        - How I felt about it (panel 4)

        [Current Panels]
        1️⃣ {panels_content['panel1']}
        2️⃣ {panels_content['panel2']}
        3️⃣ {panels_content['panel3']}
        4️⃣ {panels_content['panel4']}

        [Analysis Guidelines]
        - Each panel only needs one key point
        - Small gaps between panels are normal
        - Panel 2 can be a continuation of panel 1 and panel 3 can be a continuation of panel 2
        - Panel 4 should show a clear feeling or reaction
        - Focus on what happened, not why it happened
        - Story is complete when:
            * We can understand what happened
            * Events are connected (even if brief)
            * There is a clear emotion at the end

        [Key Points to Check]
        1. Can we understand what happened in each filled panel?
        2. Do the events connect logically?
        3. Is there a clear feeling at the end?

        [Response Format]
        Return a JSON object with:
        - flow_issues: List of major issues in event sequence. Must check:
            * Missing connections between panels
            * Missing emotions
            * List connection issues BEFORE emotion issues
        - suggested_focus: Array of panel numbers that need info, or null if okay. Example: [2, 4]
        - panel_order_ok: true if events are connected and make sense together

        Example of good connected story:
        {{
            "flow_issues": [],
            "suggested_focus": null,
            "panel_order_ok": true
        }}

        Example of current story (complete):
        Panel 1: "나는 학교 교실에서 뛰고있었다"
        Panel 2: "그러자 선생님이 내게 다가오셨다"
        Panel 3: "그리고는 선생님이 교실에서는 뛰면 안된다고 나를 혼내셨다"
        Panel 4: "나는 속상했다"

        Return:
        {{
            "flow_issues": [],
            "suggested_focus": null,
            "panel_order_ok": true
        }}

        Example of story needing connection:
        {{
            "flow_issues": ["Need to know what happened between drawing and teacher leaving", "Need to know how you felt"],
            "suggested_focus": [2, 4],
            "panel_order_ok": false
        }}

        Example of story only needing emotion:
        {{
            "flow_issues": ["Need to know how you felt"],
            "suggested_focus": [4],
            "panel_order_ok": true
        }}
        
        Example of time sequence issues:
        {{
            "flow_issues": ["Need to change the time sequence of panel 1 and 2"],
            "suggested_focus": null,
            "panel_order_ok": false
        }}"""

        

        messages = [
            SystemMessage(content="You are a 4-panel comic helper. Focus on essential missing information and always check for emotion in panel 4."),
            HumanMessage(content=prompt)
        ]

        response = await self.llm.ainvoke(messages)
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            return {
                "flow_issues": [],
                "suggested_focus": null,
                "panel_order_ok": True
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

    async def reconstruct_panel(self, panel_number: int, answer: str, question: str) -> None:
        """Reconstruct panels based on new information to tell a coherent story.
        
        Args:
            panel_number: The panel number that the question was about
            answer: User's answer to the question
            question: The question that was asked
        """
        prompt = f"""Based on the new information, create a coherent 4-panel comic diary.

        [Current Panels]
        Panel 1: {self.panels['panel1'].content if self.panels['panel1'].content else '(empty)'}
        Panel 2: {self.panels['panel2'].content if self.panels['panel2'].content else '(empty)'}
        Panel 3: {self.panels['panel3'].content if self.panels['panel3'].content else '(empty)'}
        Panel 4: {self.panels['panel4'].content if self.panels['panel4'].content else '(empty)'}

        [New Information]
        Question about panel {panel_number}: {question}
        Answer: {answer}

        [Task]
        Create a simple, coherent story that:
        - Incorporates the new answer naturally
        - Uses first-person past tense ("나는 ~했다")
        - Keeps each panel focused on one key point
        - Maintains chronological order
        - Merges duplicate or very similar content
        - Avoids repeating the same information across panels

        Example of duplicate content:
        Input panels:
        Panel 1: "나는 선생님이랑 센터에서 그림 그리기를 했다"
        Panel 2: "나는 선생님이랑 같이 그림을 그렸다"
        Panel 3: "트랜스포머가 완성되었다"
        Panel 4: "나는 기분이 좋았다"

        Return (merged properly):
        {{
            "panel1": "나는 선생님이랑 센터에서 그림 그리기를 했다",
            "panel2": "null",
            "panel3": "트랜스포머가 완성되었다",
            "panel4": "나는 기분이 좋았다"
        }}

        Return ONLY a JSON object with:
        {{
            "panel1": "content",
            "panel2": "content",
            "panel3": "content",
            "panel4": "content"
        }}

        Example 1:
        If input panels are:
        Panel 1: "소현이가 울었다"
        Panel 2: "null (내용 없음)"
        Panel 3: "나는 학교에서 길을 걷고 있었다"
        Panel 4: "null (감정 표현 필요)"

        And for Panel 2:
        Question: "소현이가 왜 울었어?"
        Answer: "내 앞을 가로막아서 지나갔더니 울었어"

        Return (fixed chronological order):
        {{
            "panel1": "나는 학교에서 길을 걷고 있었다",
            "panel2": "소현이가 내 앞을 가로막았다",
            "panel3": "내가 지나가자 소현이가 울었다",
            "panel4": "null (감정 표현 필요)"
        }}

        Example 2:
        If input panels are:
        Panel 1: "나는 복도에서 뛰어다녔다"
        Panel 2: "선생님이 그걸 보셨다"
        Panel 3: "그래서 나를 혼내셨다"
        Panel 4: "null (감정 표현 필요)"

        And for Panel 4:
        Question: "그때 기분이 어땠어?"
        Answer: "너무 부끄러웠어"

        Return (fixed chronological order):ㄴ
        {{
            "panel1": "나는 복도에서 뛰어다녔다",
            "panel2": "선생님이 그걸 보셨다",
            "panel3": "그래서 나를 혼내셨다",
            "panel4": "나는 부끄러웠다"
        }}"""

        messages = [
            SystemMessage(content="You are a story writer for a Korean diary. Follow these rules strictly:\n1. Write all output in Korean\n2. Use first-person past tense ('나는 ~했다')\n3. NEVER generate emotions unless explicitly stated by user\n4. Use 'null (감정 표현 필요)' for panel 4 if no emotion was mentioned\n5. Always arrange panels in chronological order:\n   - Start with the initial situation\n   - Follow with what happened\n   - End with the result and emotion\n6. Never assume or infer information not provided by user"),
            HumanMessage(content=prompt)
        ]
        
        response = await self.llm.ainvoke(messages)
        try:
            new_panels = json.loads(response.content)
            
            # Update all panels with new content
            for key, content in new_panels.items():
                self.panels[key] = ComicPanel(content=content)
                    
        except json.JSONDecodeError:
            print("오류: 패널 재구성에 실패했습니다")

    async def get_next_question(self) -> Optional[tuple[int, str]]:
        """Generate the next question based on essential missing information.
        
        Returns:
            Tuple of (panel_number, question) or None if story is complete.
        """
        if not self.story_analysis.get("flow_issues") and self.story_analysis.get("panel_order_ok"):
            return None

        prompt = f"""Based on the current comic panels and missing information, generate the next question.

        [Current Panels]
        Panel 1: {self.panels['panel1'].content if self.panels['panel1'].content else '(empty)'}
        Panel 2: {self.panels['panel2'].content if self.panels['panel2'].content else '(empty)'}
        Panel 3: {self.panels['panel3'].content if self.panels['panel3'].content else '(empty)'}
        Panel 4: {self.panels['panel4'].content if self.panels['panel4'].content else '(empty)'}

        [Missing Information]
        {chr(10).join(f"- {issue}" for issue in self.story_analysis.get("flow_issues", []))}

        [Task]
        Generate ONE specific question in Korean that will:
        - Target exactly what we need to know based on the flow issue
        - Focus on the gap or missing information between panels
        - Use casual, friendly language
        - Include one emoji at the end

        Return ONLY a JSON object with:
        {{
            "panel_number": number (1-4),
            "question": "question in Korean"
        }}

        Example 1:
        If we need to know what happened between walking and being scolded:
        {{
            "panel_number": 2,
            "question": "선생님이 혼내시기 전에 무슨 일이 있었어? 🤔"
        }}

        Example 2:
        If we need to know why teacher got angry:
        {{
            "panel_number": 2,
            "question": "선생님이 왜 화나셨던 거야? 😮"
        }}

        Example 3:
        If we need to know specific details about an action:
        {{
            "panel_number": 2,
            "question": "횡단보도를 어떻게 건넜는지 자세히 말해줄래? 🚶"
        }}"""

        messages = [
            SystemMessage(content="You are a friendly interviewer. Ask specific questions to fill the gaps in the story."),
            HumanMessage(content=prompt)
        ]

        response = await self.llm.ainvoke(messages)
        try:
            result = json.loads(response.content)
            return (result["panel_number"], result["question"])
        except (json.JSONDecodeError, KeyError):
            if self.story_analysis.get("suggested_focus"):
                return (self.story_analysis["suggested_focus"], "더 자세히 말해줄래? 🤔")
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
            
            If a panel is empty, its content will be "내용 없음"
        """
        result = {}
        for i in range(1, 5):
            panel_key = f"panel{i}"
            panel = self.panels.get(panel_key)
            if panel and panel.content:
                result[panel_key] = panel.content
            else:
                result[panel_key] = "내용 없음"
        
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
        generator.story_analysis = await generator.analyze_story_flow()
        
        # Print current status
        print("\n=== 현재 상태 ===")
        if generator.story_analysis.get("flow_issues"):
            print("\n스토리 흐름 문제:")
            for issue in generator.story_analysis["flow_issues"]:
                print(f"- {issue}")
        
        print("\n현재 패널:")
        for i in range(1, 5):
            panel = generator.panels[f"panel{i}"]
            if panel.content:
                print(f"패널 {i}: {panel.content}")
            else:
                print(f"패널 {i}: 내용 없음")

        # If story is complete, return final result
        if not generator.story_analysis.get("flow_issues") and generator.story_analysis.get("panel_order_ok"):
            return generator.get_final_result()

        # 2. Get next question based on analysis
        next_question = await generator.get_next_question()
        if not next_question:
            return generator.get_final_result()
            
        # 3. Ask question and get answer
        panel_number, question = next_question
        print(f"\n친구: {question}")
        print("유찬: ", end='', flush=True)
        
        try:
            answer = input().strip()
        except UnicodeDecodeError:
            # If there's an encoding error, try to read raw bytes and decode with replacement
            raw_input = sys.stdin.buffer.readline()
            answer = raw_input.decode('utf-8', errors='replace').strip()
            
        if not answer:
            continue
            
        # 4. Reconstruct panels with new information
        await generator.reconstruct_panel(panel_number, answer, question)
        # (analyze_story_flow will be called at the start of next loop)

if __name__ == "__main__":
    # Example input JSON
    example_input = {
        "panel1": "나는 엄마랑 집 근처에서 산책했다",
        "panel2": "null (산책 중에 어쩌다 엄마와 어떤 특정 이야기를 나누었는지 모르기 때문)",
        "panel3": "나는 엄마와 놀이공원에 가고 싶은 이야기를 했다",
        "panel4": "null (감정 표현 필요)"
    }
    asyncio.run(run_comic_conversation(example_input))





    