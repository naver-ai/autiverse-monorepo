from typing import Dict, Any, Optional
from comic_context import ComicContextGenerator, CHARACTER_BACKGROUND, ComicPanel
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
import asyncio
import json
import sys

class ComicRevisionSystem:
    def __init__(self, input_json: str, temperature: float = 0.1, model: str = "gpt-4.1-mini-2025-04-14"):
        self.llm = ChatOpenAI(
            model=model,
            temperature=temperature,
            openai_api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.comic_generator = ComicContextGenerator(input_json, temperature, model)
        self.revision_count = 0
        self.max_revisions = 2

    async def start_revision_conversation(self):
        """Start the revision conversation loop"""
        # Set up proper encoding for input/output
        if sys.platform == 'win32':
            sys.stdin.reconfigure(encoding='utf-8')
            sys.stdout.reconfigure(encoding='utf-8')
        else:
            import io
            sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')
            sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

        print("\n=== 만화 수정하기 ===")
        
        while self.revision_count < self.max_revisions:
            # Display current panels
            await self._display_current_panels()
            
            # Ask if there are any mistakes
            print(f"\n도도: 여기서 수정하거나 추가하고 싶은 부분 있어? 🤔")
            user_response = input("유찬: ").strip()
            
            if user_response.lower() in ['아니', '아니요', 'no', 'n']:
                print("도도: 그럼 완벽하네! 👏")
                break
            elif user_response.lower() in ['응', '네', 'yes', 'y']:
                self.revision_count += 1
                
                if self.revision_count > self.max_revisions:
                    print("도도: 장난치지마~ 😤")
                    break
                
                # Check if this is the last revision opportunity
                if self.revision_count == self.max_revisions:
                    print("도도: 아앗;; 이제 마지막 기회야! 지금 수정하거나 추가하고 싶은 부분이 있다면 다 말해줘~ 😅")
                else:
                    print("도도: 어디를 어떻게 수정해볼까?? 🤔")
                
                user_correction = input("유찬: ").strip()
                
                # Apply the correction
                await self._apply_revision(user_correction)
                
                # Ask if it's correct now
                print("도도: 네가 말해준 내용대로 바꿔봤어. 이제 다 맞을까? 🤔")
                
            else:
                print("도도: 응 아니 중에 골라줘! 😅")
                continue
        
        # Show final result
        await self._display_final_result()

    async def _display_current_panels(self):
        """Display current comic panels"""
        print("\n=== 현재 만화 ===")
        for i in range(1, 5):
            panel = self.comic_generator.panels.get(f"panel{i}")
            content = panel.content if panel and panel.content else "null"
            print(f"패널 {i}: {content}")

    async def _apply_revision(self, user_correction: str):
        """Apply user's revision to the comic panels"""
        system_prompt = f"""
        {CHARACTER_BACKGROUND}

You are a revision assistant that helps fix 4-panel comic stories based on user feedback.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

REVISION RULES:
1. When user corrects only the ACTION/BEHAVIOR, preserve the LOCATION/CONTEXT
2. When user corrects LOCATION/PLACE, replace the entire location context
3. When user says something is "not correct" or "wrong", identify what part is wrong:
   - If it's the ACTION: keep location, change action
   - If it's the LOCATION: change location completely
   - If it's the WHOLE SENTENCE: replace completely

4. Understand the user's correction request and apply it appropriately
5. Maintain the ABCD structure while making the requested changes
6. Keep each panel to one Korean past-tense sentence, first-person diary style
7. Only change what the user specifically requested
8. Preserve the overall story flow and coherence
9. Output exactly this JSON format:

{{
  "panel1": "...",
  "panel2": "...", 
  "panel3": "...",
  "panel4": "..."
}}

10. If a panel should remain unchanged, use the original content
11. If a panel should be null, use "null"
12. Write in natural Korean
13. **IMPORTANT**: Make sure the story remains coherent and logical after revision
"""

        # Get current panel contents
        current_panels = {}
        for i in range(1, 5):
            panel = self.comic_generator.panels.get(f"panel{i}")
            current_panels[f"panel{i}"] = panel.content if panel and panel.content else "null"

        user_prompt = f"""Current comic panels:
"panel1": "{current_panels['panel1']}",
"panel2": "{current_panels['panel2']}",
"panel3": "{current_panels['panel3']}",
"panel4": "{current_panels['panel4']}"

User's correction request: {user_correction}

Please apply the user's correction while maintaining the ABCD structure and story coherence. 
Analyze whether the user is correcting:
- Only the ACTION (keep location/context)
- Only the LOCATION (replace location completely)  
- The entire content (replace completely)

Make sure the revised story is logical and coherent."""

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_prompt)
        ]
        
        response = await self.llm.ainvoke(messages)
        try:
            revised_panels = json.loads(response.content)
            
            # Update all panels with revised content
            for key, content in revised_panels.items():
                if content == "null":
                    self.comic_generator.panels[key] = ComicPanel(content=None)
                else:
                    self.comic_generator.panels[key] = ComicPanel(content=content)
            
            print("\n도도: 알겠어! 그렇게 수정해볼게! ✏️")
            
        except json.JSONDecodeError:
            print("도도: 어? 수정하는데 문제가 생겼어. 다시 말해줘! 😅")

    async def _display_final_result(self):
        """Display the final revised comic"""
        print("\n=== 최종 수정된 만화 ===")
        for i in range(1, 5):
            panel = self.comic_generator.panels.get(f"panel{i}")
            content = panel.content if panel and panel.content else "null"
            print(f"패널 {i}: {content}")
        
        print("\n이제 만화일기 완성이닷 🏅")

async def run_comic_revision(input_json: str):
    """Main function to run the comic revision system"""
    revision_system = ComicRevisionSystem(input_json)
    await revision_system.start_revision_conversation()

if __name__ == "__main__":
    # Example input JSON for testing
    example_input = {
        "panel1": {"content": "나는 학교에서 길을 가고 있었다", "missing_content": None},
        "panel2": {"content": "갑자기 선생님이 나타나서 나를 혼냈다", "missing_content": None},
        "panel3": {"content": "선생님이 나를 교무실로 데려갔다", "missing_content": None},
        "panel4": {"content": "나는 너무 무서웠다", "missing_content": None}

    }
    
    asyncio.run(run_comic_revision(example_input))
