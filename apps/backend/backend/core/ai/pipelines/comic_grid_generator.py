import json
import asyncio
from backend.utils.environment import get_env_variable, EnvironmentVariables
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage, SystemMessage

# 전역 캐시
_llm_cache = {}
_parser_cache = {}

class StoryElement(BaseModel):
    """Individual story element for comic analysis"""
    panel: str = Field(description="Panel number (1-4)")
    act: str = Field(description="Action or activity (Korean verb phrase)")
    figure: str = Field(description="Characters involved in the action")
    object: str = Field(description="Physical objects involved (empty string if none)")
    location: str = Field(description="Location where action occurs (empty string if none)")
    think: Optional[str] = Field(default=None, description="Thought content (only for act='생각')")
    tell: Optional[str] = Field(default=None, description="Spoken dialogue (only for act='대화')")
    emotion: Optional[str] = Field(default=None, description="Emotion word (only for act='감정')")

class StoryAnalysis(BaseModel):
    """Complete story analysis result"""
    elements: List[StoryElement] = Field(description="List of story elements extracted from panels")

class TopologyRelationship(BaseModel):
    """Individual topology relationship"""
    target_1: str = Field(description="First target element")
    target_2: str = Field(description="Second target element")
    topology: str = Field(description="Spatial relationship (beside, below, above, etc.)")

class TopologyAnalysis(BaseModel):
    """Complete topology analysis result"""
    relationships: List[TopologyRelationship] = Field(description="List of topology relationships")

class GridElement(BaseModel):
    """Individual grid element with position"""
    type: str = Field(description="Element type (figure or object)")
    content: str = Field(description="Element content")
    position: List[int] = Field(description="Grid position [x, y]")

class GridLayout(BaseModel):
    """Complete grid layout result"""
    elements: List[GridElement] = Field(description="List of positioned grid elements")

class ComicGridGenerator:
    def __init__(self):
        # LLM 캐싱
        model_key = "gpt-4.1-mini-2025-04-14"
        if model_key not in _llm_cache:
            _llm_cache[model_key] = ChatOpenAI(
                model=model_key,
                temperature=0.2,
                api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY),
                timeout=30  # 30초 타임아웃
            )
        self.llm = _llm_cache[model_key]

    async def generate_comic_grids(self, panel_contents: Dict[str, str], progress_callback=None) -> Dict[str, Any]:
        """비동기적으로 만화 그리드 생성"""
        try:
            # FourSceneComic 인스턴스 생성
            comic_generator = FourSceneComic(panel_contents)
            return await comic_generator.generate(progress_callback)
        except Exception as e:
            print(f"Error in ComicGridGenerator: {e}")
            return {
                "panel1": {"content": "", "grid": self._create_empty_grid()},
                "panel2": {"content": "", "grid": self._create_empty_grid()},
                "panel3": {"content": "", "grid": self._create_empty_grid()},
                "panel4": {"content": "", "grid": self._create_empty_grid()}
            }

    def _create_empty_grid(self):
        return [[{"type": "empty", "content": "", "position": [x, y]} for x in range(5)] for y in range(5)]

class FourSceneComic:
    def __init__(self, panel_contents: Dict[str, str]):
        # LLM 캐싱
        model_key = "gpt-4.1-mini-2025-04-14"
        if model_key not in _llm_cache:
            _llm_cache[model_key] = ChatOpenAI(
                model=model_key,
                temperature=0.2,
                api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY),
                timeout=30  # 30초 타임아웃
            )
        self.llm = _llm_cache[model_key]
        
        self.panels = panel_contents
        
        # Parser 캐싱
        if "story_parser" not in _parser_cache:
            _parser_cache["story_parser"] = PydanticOutputParser(pydantic_object=StoryAnalysis)
        if "topology_parser" not in _parser_cache:
            _parser_cache["topology_parser"] = PydanticOutputParser(pydantic_object=TopologyAnalysis)
        if "grid_parser" not in _parser_cache:
            _parser_cache["grid_parser"] = PydanticOutputParser(pydantic_object=GridLayout)
        
        self.parser = _parser_cache["story_parser"]
        self.topology_parser = _parser_cache["topology_parser"]
        self.grid_parser = _parser_cache["grid_parser"]

    @staticmethod
    def _create_empty_grid():
        return [[{"type": "empty", "content": "", "position": [x, y]} for x in range(5)] for y in range(5)]

    async def _analyze_story(self) -> List[Dict]:
        """1단계: 전체 스토리 분석 - Structured Output 사용"""
        system_prompt = """You are an expert in information-extraction and comic scene designer. Analyze the comic panels and extract story elements.

IMPORTANT: You must return a JSON object with an "elements" field containing the array of story elements.

Rules for extraction:

1. Allowed keys (exact spelling, lower-case):
panel, act, figure, object, location, think, tell, emotion

2. Act selection
• If the sentence expresses thought or desire → act:"생각" and fill think with the thought content
  - Use "~거야" form for thoughts (예: "놀이공원에 가고 싶다" → "놀이공원에 가고 싶어")
  - Do not use "~거라" form
• If the sentence contains speech or dialogue:
  - Extract the spoken content and set act:"대화" with tell
  - **CRITICAL: Only assign the dialogue to the person who is actually speaking**
  - **CRITICAL: When multiple people are mentioned, identify the actual speaker**
  - If there's another action in the same sentence, create a separate entry with that action
  Example: "경비아저씨가 우리에게 비가 많이 오니 피하라고 큰소리 치셨다"
    → {
      "elements": [
        {"panel":"2","act":"대화","figure":"경비아저씨","object":"","location":"공원", "tell":"비가 많이 오니 피해!"},
        {"panel":"2","act":"큰소리치셨다","figure":"경비아저씨","object":"","location":"공원"}
      ]
    }
  Example: "민수가 나에게 어디 가냐고 물어서 나는 슈퍼에 간다고 했다"
    → {
      "elements": [
        {"panel":"3","act":"대화","figure":"민수","object":"","location":"", "tell":"어디가?"},
        {"panel":"3","act":"대화","figure":"나","object":"","location":"", "tell":"슈퍼에 가"}
      ]
    }
• Otherwise, set act to the exact Korean verb phrase appearing in the sentence (예: 찼다, 날아갔다, 나갔다, 산책했다, 숨었다)
  - Also extract any objects that are part of the action
  - Example: "컴퓨터 게임 중이었다" → act:"게임 중이었다", object:"컴퓨터"
  - Example: "책을 읽고 있었다" → act:"읽고 있었다", object:"책"
  - Example: "축구공을 찼다" → act:"찼다", object:"축구공"

3. Figure and Location extraction
• Always extract the subject of the action as figure
  - Extract ONLY the person/character name who is performing the action
  - **CRITICAL: When "우리" (We) appears in the text, replace it with the actual character names mentioned in the context**
  - **CRITICAL: "우리" should NEVER appear in the figure field - always use specific character names**
  - Example: "엄마가 나에게 말했다" → figure:"엄마, 나" (both participants in conversation)
  - Example: "나는 민수가 좋다고 생각했다" → figure:"나" (the one who is thinking)
  - Example: "엄마가 나를 사랑한다고 말했다" → figure:"엄마" (the one who is speaking)
  - Example: "엄마와 내가 대화했다" → figure:"엄마, 나" (both participants in conversation)
  - Example: "나는 민수를 찾았다" → figure:"나, 민수" (both participants)
  - Example: "나는 텀블러를 찾았다" → figure:"나" (tumbler is not a human)
  - Example: "우리는 공을 찾으러 담장 밖으로 나가서 공을 찾았다" → figure:"나, 민수" (replace "우리" with actual characters)
  - Example: "우리는 급히 뛰어가서 버스정류장 밑에서 비를 피했다" → figure:"나, 친구" (replace "우리" with actual characters)
• Extract location ONLY when the action actually happens at that place (using ~에서, ~에, etc.)
  - Correct: "공원에서 놀았다" → location:"공원"
  - Correct: "버스정류장 밑으로 뛰어갔다" → location:"버스정류장 밑"
  - Incorrect: "꿈에 놀이공원이 나왔어" → location:"" (just mentioned, not the current action location)
• When analyzing location with spatial relations (밑, 위, 옆, 앞, 뒤), treat the reference object as both object and location
• When an action involves multiple figures (주체와 대상), include all of them in the figure field
  Example: "내가 영호를 밀었다"
    → figure:"나, 영호", act:"밀었다"
  Example: "선생님이 나를 잡았다"
    → figure:"선생님, 나", act:"잡았다"

4. Object selection
• Only physical objects that can be seen or touched should be listed as objects
• Do not treat actions or verbs as objects
• Do not treat spoken words or dialogue as objects
• Do not treat location names as objects
• IMPORTANT: Spoken, think, emotion content (tell, think, emotion) should NEVER be treated as object
• Examples of objects: 축구공, 의자, 책, 가방, 공책
• Examples of what are NOT objects: 점프, 달리기, 걷기, 뛰기

5. One panel may contain multiple actions; output one object per action, all with the same panel value.

6. Preserve every Korean word exactly as written in the panels.

7. For any empty value, write an empty string "".

8. Respond with valid structured output only—no explanations, comments, or extra keys.

Below is a worked example; follow the same schema

Example 1:
panel1: "나는 엄마랑 집 근처에서 산책했다"
panel2: "산책하다보니 놀이공원에 가고 싶어졌다."
panel3: "그래서 엄마에게 놀이공원 가고 싶다고 이야기를 했고 엄마도 가자고 했다"
panel4: "나는 기뻤다"

Expected elements:
[
{"panel":"1","act":"산책했다","figure":"나, 엄마","object":"","location":"집 근처"},
{"panel":"2","act":"생각","figure":"나","object":"","location":"집 근처","think":"놀이공원에 가고 싶어"},
{"panel":"3","act":"대화","figure":"나","object":"","location":"집 근처","tell":"놀이공원 가고 싶어요!"},
{"panel":"3","act":"대화","figure":"엄마","object":"","location":"집 근처","tell":"그래, 가자!"},
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"기쁨"}
]

Example 2:
panel1: "나는 민수와 학교 운동장에서 축구공을 찼다"
panel2: "민수가 어하는 순간 공이 담장을 넘었다"
panel3: "우리는 공을 찾으러 담장 밖으로 나가서 공을 찾았다"
panel4: "나는 기뻤다"

Expected elements:
[
{"panel":"1","act":"찼다","figure":"나, 민수","object":"축구공","location":"학교 운동장"},
{"panel":"2","act":"대화","figure":"민수","object":"","location":"","tell":"어!"},
{"panel":"2","act":"날아갔다","figure":"축구공","object":"","location":"담장 너머"},
{"panel":"3","act":"나갔다","figure":"나, 민수","object":"","location":"담장 밖"},
{"panel":"3","act":"찾았다","figure":"나, 민수","object":"축구공","location":"담장 밖"},
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"기쁨"}
]

Example 3:
panel1: "나는 공원에서 친구에게 선물을 주고 있었다."
panel2: "그런데 갑자기 경비아저씨가 우리에게 비가 많이 오니 피하라고 큰소리 치셨다"
panel3: "우리는 급히 뛰어가서 버스정류장 밑에서 비를 피했다"
panel4: "나는 비에 젖어서 화가 났다"

Expected elements:
[
{"panel":"1","act":"선물을 주고 있었다","figure":"나, 친구","object":"","location":"공원"},
{"panel":"2","act":"대화","figure":"경비아저씨","object":"","location":"공원", "tell":"비가 많이 오니 피해!"},
{"panel":"2","act":"큰소리치셨다","figure":"경비아저씨","object":"","location":"공원"},
{"panel":"3","act":"뛰어갔다","figure":"나, 친구","object":"","location":""},
{"panel":"3","act":"피했다","figure":"나, 친구","object":"비","location":"버스정류장 밑"},
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"화남"}
]
**Note: In this example, "우리" in panel2 and panel3 refers to "나, 친구" based on the context from panel1.**
"""

        user_prompt = f'''Convert the new panels that follow.
Panel 1: "{self.panels.get('panel1', '')}"
Panel 2: "{self.panels.get('panel2', '')}"
Panel 3: "{self.panels.get('panel3', '')}"
Panel 4: "{self.panels.get('panel4', '')}"
'''

        # Retry logic for structured output
        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                
                response = await self.llm.ainvoke(messages)
                result = self.parser.parse(response.content)
                
                # Convert to list of dicts for compatibility
                story_elements = [element.model_dump() for element in result.elements]
                print(f"Story Analysis Result: {json.dumps(story_elements, ensure_ascii=False, indent=2)}")
                return story_elements
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed, returning empty result")
                    return []
                await asyncio.sleep(1)  # Brief delay before retry

    async def generate(self, progress_callback=None) -> Dict[str, Any]:
        """Generate comic panels with grid layouts"""
        try:
            # 1단계: 전체 스토리 분석 (admin-web과 동일한 로그)
            if progress_callback:
                await progress_callback(20, "어떻게 그릴지 고민중이다~")
            story_analysis = await self._analyze_story()
            
            # 2단계: 각 패널의 위치 관계 결정
            if progress_callback:
                await progress_callback(40, "오케이! 이렇게 그려보겠어!")
            result = {}
            for i, panel_id in enumerate(['panel1', 'panel2', 'panel3', 'panel4']):
                panel_content = self.panels.get(panel_id, '')
                if panel_content and panel_content.strip():  # 내용이 있고 비어있지 않은 경우만
                    if progress_callback:
                        await progress_callback(60 + (i * 10), f"{i+1}번째 컷 그리는 중~")
                    
                    panel_num = panel_id.replace('panel', '')
                    panel_elements = [elem for elem in story_analysis if elem.get('panel') == panel_num]
                    
                    # place 정보 추출 (첫 번째 location 사용)
                    place = ""
                    for elem in panel_elements:
                        if elem.get('location'):
                            place = elem['location']
                            break
                    
                    grid_layout = await self._determine_topology(panel_id, story_analysis)
                    result[panel_id] = {
                        "content": panel_content,
                        "place": place,
                        "grid": grid_layout
                    }
                else:
                    # 빈 패널도 완료된 것으로 처리
                    if progress_callback:
                        await progress_callback(60 + (i * 10), f"{i+1}번째 컷 처리 중~")
                    result[panel_id] = {
                        "content": "",
                        "place": "",
                        "grid": []  # 빈 배열로 저장
                    }
            
            if progress_callback:
                await progress_callback(100, "완성이닷!")
            return result
            
        except Exception as e:
            print(f"Error generating comic: {e}")
            return {
                "panel1": {"content": "", "grid": self._create_empty_grid()},
                "panel2": {"content": "", "grid": self._create_empty_grid()},
                "panel3": {"content": "", "grid": self._create_empty_grid()},
                "panel4": {"content": "", "grid": self._create_empty_grid()}
            }

    async def _determine_topology(self, panel_id: str, story_analysis: List[Dict]) -> List[Dict]:
        """2단계: 각 패널의 위치 관계 결정 (admin-web과 동일한 로그)"""
        try:
            panel_num = panel_id.replace('panel', '')
            panel_elements = [elem for elem in story_analysis if elem.get('panel') == panel_num]
            
            # Topology 결정 (admin-web과 동일한 로그)
            topology = await self._get_topology_relationships(panel_id, panel_elements)
            print(f"Topology for panel {panel_id}: {json.dumps(topology, ensure_ascii=False, indent=2)}")
            
            # Grid 위치 결정 (admin-web과 동일한 로그)
            layout = await self._determine_grid_positions(topology, panel_elements)
            
            # layout 데이터를 그대로 반환 (5x5 grid로 변환하지 않음)
            return layout
        except Exception as e:
            print(f"Error determining topology for {panel_id}: {e}")
            import traceback
            traceback.print_exc()
            return []

    async def _get_topology_relationships(self, panel_id: str, panel_elements: List[Dict]) -> List[Dict]:
        """Topology 관계 결정"""
        if not panel_elements:
            return []
            
        # Location 정보만 제거하여 topology에서 배제 (패널 속성으로는 유지)
        filtered_elements = []
        for element in panel_elements:
            filtered_element = element.copy()
            if 'location' in filtered_element:
                filtered_element['location'] = ""  # topology에서는 제거
            filtered_elements.append(filtered_element)
            
        system_prompt = """You are a comic panel topology designer that determines core relationships between figures and objects.

Input  : One panel's semantic JSON objects  
Output : A JSON object with a "relationships" field containing an array of items where every relevant pair of elements is represented by an object describing their spatial relationship (topology).
Respond with the object only—no extra text.

OUTPUT FORMAT
- A JSON array of objects.
- Keys: "target_1", "target_2", "topology".
- topology is one or more keywords separated by ", ".
- Do not wrap the array in code fences or prose.

RELATION KEYWORDS (fixed)
beside  → laterally adjacent or same row
below   → target 2 is below target 1 (target 2 is in front of target 1, target 2 will be placed in a row with a larger number than target 1)
above   → target 2 is above target 1 (target 2 is behind target 1, target 2 will be placed in a row with a smaller number than target 1)
(Use only these unless told otherwise.)

JUDGMENT RULES
1. act (행동) hints at positions
   - "찼다/차다/발로" → figure ↔ object: beside, below
   - "던졌다/날아갔다" → figure → object: below; object → obstacle: above
   - "피했다/숨었다" → figure → shelter: above; shelter → threat: below
2. location can add background elements (담장, 운동장, 의자 등)
   - "A 너머 B" means A is below B, B is above A
   - "A 밑 B" means A is above B, B is below A
   - "A 밑에 숨었다" → figure → A: above (figure is under A)
   - "A 위에 올라갔다" → figure → A: below (figure is on top of A)
3. 대화 / tell / 생각 / think / 감정 / emotion
   - Create "말풍선" for tell, "생각" for think, "감정" for emotion
   - Speaker ↔ balloon/cloud/emotion: beside, below, above (all apply)
4. Multiple figures default to beside unless text says otherwise
5. If multiple objects exist, output every unordered pair exactly once
6. IMPORTANT: When location contains spatial relationships (밑, 위, 옆, 앞, 뒤), treat the reference object as a separate element
   - "의자 밑" → treat "의자" as an object element
   - "테이블 위" → treat "테이블" as an object element
   - "문 앞" → treat "문" as an object element

Below is a worked example; follow the same schema.

EXAMPLE 1  
INPUT  
{"panel":"1","act":"찼다","figure":"나, 민수","object":"축구공","location":"학교 운동장"}  
OUTPUT  
{
  "relationships": [
    {"target_1":"나","target_2":"민수","topology":"beside"},
    {"target_1":"나","target_2":"축구공","topology":"beside, below"},
    {"target_1":"민수","target_2":"축구공","topology":"beside, below"}
  ]
}

EXAMPLE 2  
INPUT  
{"panel":"2","act":"대화","figure":"민수","object":"","location":"","tell":"어!?"},
{"panel":"2","act":"날아갔다","figure":"축구공","object":"","location":"담장 너머"}  
OUTPUT  
{
  "relationships": [
    {"target_1":"민수","target_2":"어!?","topology":"beside, below, above"},
    {"target_1":"담장","target_2":"축구공","topology":"above"},
    {"target_1":"민수","target_2":"담장","topology":"apart"}
  ]
}

EXAMPLE 2-2
INPUT  
{"panel":"4","act":"감정","figure":"나","object":"","location":"","emotion":"신남"}
OUTPUT  
{
  "relationships": [
    {"target_1":"나","target_2":"신남","topology":"beside, below, above"}
  ]
}

EXAMPLE 3
INPUT  
{"panel":"3","act":"피했다","figure":"나, 친구","object":"비","location":"버스정류장 밑"}
OUTPUT  
{
  "relationships": [
    {"target_1":"나, 친구","target_2":"버스정류장","topology":"above"},
    {"target_1":"버스정류장","target_2":"비","topology":"above"}
  ]
}

EXAMPLE 4
INPUT  
{"panel":"2","act":"숨었다","figure":"나","object":"","location":"의자 밑"}
OUTPUT  
{
  "relationships": [
    {"target_1":"나","target_2":"의자","topology":"above"},
    {"target_1":"의자","target_2":"나","topology":"below"}
  ]
}"""

        user_prompt = f"""Convert below elements to the topology:
Input elements for panel {panel_id}:
{json.dumps(filtered_elements, ensure_ascii=False, indent=2)}"""

        # Retry logic for robust parsing
        for attempt in range(3):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                response = await self.llm.ainvoke(messages)
                result = self.topology_parser.parse(response.content)
                
                # Convert Pydantic result to list of dictionaries for compatibility
                topology = []
                for rel in result.relationships:
                    topology.append({
                        "target 1": rel.target_1,
                        "target 2": rel.target_2,
                        "topology": rel.topology
                    })
                break
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == 2:  # Last attempt
                    print("All attempts failed, returning empty topology")
                    topology = []
                else:
                    await asyncio.sleep(1)  # Wait before retry
        
        # topology에서 figure를 찾아서 action 추가하고, tell/think/emotion을 null로 처리
        processed_tell_contents = set()
        processed_think_contents = set()
        processed_emotion_contents = set()
        action_data = {}
        
        for rel in topology:
            target1_content = str(rel.get('target 1', ''))
            target2_content = str(rel.get('target 2', ''))
            
            # target이 figure인지 확인하고 action 추가
            for elem in panel_elements:
                if elem.get('figure'):
                    figures = elem['figure'].split(', ')
                    
                    # target 1이 figure인 경우
                    if target1_content in figures:
                        if elem.get('tell'):
                            processed_tell_contents.add(elem['tell'])
                            if target1_content not in action_data:
                                action_data[target1_content] = []
                            # 중복 방지
                            if not any(action['type'] == 'tell' and action['content'] == elem['tell'] for action in action_data[target1_content]):
                                action_data[target1_content].append({'type': 'tell', 'content': elem['tell']})
                        if elem.get('think'):
                            processed_think_contents.add(elem['think'])
                            if target1_content not in action_data:
                                action_data[target1_content] = []
                            # 중복 방지
                            if not any(action['type'] == 'think' and action['content'] == elem['think'] for action in action_data[target1_content]):
                                action_data[target1_content].append({'type': 'think', 'content': elem['think']})
                        if elem.get('emotion'):
                            processed_emotion_contents.add(elem['emotion'])
                            if target1_content not in action_data:
                                action_data[target1_content] = []
                            # 중복 방지
                            if not any(action['type'] == 'emotion' and action['content'] == elem['emotion'] for action in action_data[target1_content]):
                                action_data[target1_content].append({'type': 'emotion', 'content': elem['emotion']})
                    
                    # target 2가 figure인 경우
                    if target2_content in figures:
                        if elem.get('tell'):
                            processed_tell_contents.add(elem['tell'])
                            if target2_content not in action_data:
                                action_data[target2_content] = []
                            # 중복 방지
                            if not any(action['type'] == 'tell' and action['content'] == elem['tell'] for action in action_data[target2_content]):
                                action_data[target2_content].append({'type': 'tell', 'content': elem['tell']})
                        if elem.get('think'):
                            processed_think_contents.add(elem['think'])
                            if target2_content not in action_data:
                                action_data[target2_content] = []
                            # 중복 방지
                            if not any(action['type'] == 'think' and action['content'] == elem['think'] for action in action_data[target2_content]):
                                action_data[target2_content].append({'type': 'think', 'content': elem['think']})
                        if elem.get('emotion'):
                            processed_emotion_contents.add(elem['emotion'])
                            if target2_content not in action_data:
                                action_data[target2_content] = []
                            # 중복 방지
                            if not any(action['type'] == 'emotion' and action['content'] == elem['emotion'] for action in action_data[target2_content]):
                                action_data[target2_content].append({'type': 'emotion', 'content': elem['emotion']})
        
        # topology에서 처리된 tell/think/emotion 내용을 null로 처리
        filtered_topology = []
        for rel in topology:
            filtered_rel = rel.copy()
            
            # target이 tell/think/emotion 내용과 일치하면 null로 처리
            target1_content = str(rel.get('target 1', ''))
            target2_content = str(rel.get('target 2', ''))
            
            if target1_content in processed_tell_contents or target1_content in processed_think_contents or target1_content in processed_emotion_contents:
                filtered_rel['target 1'] = None
            if target2_content in processed_tell_contents or target2_content in processed_think_contents or target2_content in processed_emotion_contents:
                filtered_rel['target 2'] = None
                
            filtered_topology.append(filtered_rel)
        
        # action_data를 filtered_topology에 추가 (나중에 사용하기 위해)
        filtered_topology.append({'__action_data': action_data})
        
        return filtered_topology

    async def _determine_grid_positions(self, topology: List[Dict], elements: List[Dict]) -> List[Dict]:
        """Grid 위치 결정 (admin-web과 동일한 로그)"""
        
        # 모든 요소들을 수집 (중복 방지)
        element_set = set()
        all_elements = []
        
        def add_element(type_name: str, content: str):
            key = f"{type_name}:{content}"
            if key not in element_set:
                element_set.add(key)
                all_elements.append({"type": type_name, "content": content})
        
        for element in elements:
            # 인물 추가
            if element.get('figure'):
                for figure in element['figure'].split(', '):
                    add_element('figure', figure)
            # 물체 추가
            if element.get('object'):
                add_element('object', element['object'])

        print(f"Elements to place: {json.dumps(all_elements, ensure_ascii=False, indent=2)}")

        system_prompt = """You are a comic panel layout designer. You MUST follow these rules strictly:

IMPORTANT: You must return a JSON object with an "elements" field containing the array of grid elements.

1. Grid is 5x5 (0-4 for both x and y)
   - Row 0 is at the top, Row 4 is at the bottom
   - Column 0 is at the left, Column 4 is at the right
2. Figures should be placed in rows 1-3
3. Objects should be placed relative to their related figures
4. Location information is ONLY used for reference in topology relationships, NEVER place it in the grid
5. ONLY elements from "Elements to place" should be included in the output
6. ALL elements mentioned in "Topology relationships" MUST be included in the output
7. Location names (like "공원", "학교", etc.) should NEVER be placed in the grid
8. Spoken words (tell), thoughts (think), and emotions (emotion) should NEVER be placed in the grid - they are handled as actions
9. IMPORTANT: Even if you see tell/think/emotion content in topology relationships, DO NOT place them in the grid

Topology to Grid Position Rules:
1. Position relationships:
   - beside: If A is beside B, place them in different columns but SAME row
   - below: If A is below B, place A in a row with a larger number than B (A is in front of B)
   - above: If A is above B, place A in a row with a smaller number than B (A is behind B)
   - If multiple elements have a 'beside' relationship (e.g., A, B, C all beside each other), ALL of them MUST be placed in the SAME row (row number must be identical), and only columns should differ.
2. Multiple relationships:
   - If there is ONLY ONE relationship, you MUST follow it EXACTLY
     Example: If A is "beside" B, they MUST be in the same row
     Example: If A is "below" B, A MUST be in a row with larger number
     Example: If A is "above" B, A MUST be in a row with smaller number
   - If there are TWO relationships, you MUST satisfy AT LEAST ONE of them
     Example: If A is "beside, below" B:
       * Either place them in the same row (satisfying "beside")
       * OR place A in a row with larger number (satisfying "below")
     Example: If A is "beside, above" B:
       * Either place them in the same row (satisfying "beside")
       * OR place A in a row with smaller number (satisfying "above")

IMPORTANT RULES:
1. ALL elements from "Elements to place" MUST be included in the output
2. ALL elements mentioned in "Topology relationships" MUST be included in the output
3. For single relationships, you MUST follow them EXACTLY
4. For double relationships, you MUST satisfy at least one of them
5. If multiple elements are mutually beside, ALL must be in the same row
6. No elements should be missing

VALIDATION CHECK:
Before returning the output, verify that:
1. All single relationships are EXACTLY satisfied
2. All double relationships satisfy at least one condition
3. All elements from the input are included
4. All elements mentioned in topology relationships are present in the output
5. If multiple elements are mutually beside, ALL must be in the same row

Example 1:
Input elements:
[
  {"type": "figure", "content": "나"},
  {"type": "figure", "content": "민수"},
  {"type": "object", "content": "버스정류장"}
]

Input topology:
[
  {"target 1": "나", "target 2": "민수", "topology": "beside"},
  {"target 1": "나", "target 2": "말풍선", "topology": "beside, below"},
  {"target 1": "나", "target 2": "버스정류장", "topology": "above"},
  {"target 1": "민수", "target 2": "버스정류장", "topology": "above"}
]

Expected output:
{
  "elements": [
    {"type": "figure", "content": "나", "position": [2, 2]},
    {"type": "figure", "content": "민수", "position": [3, 2]},
    {"type": "object", "content": "버스정류장", "position": [2, 1]},
    {"type": "object", "content": "버스정류장", "position": [3, 1]}
  ]
}

Example 2:
Input elements:
[
  {"type": "figure", "content": "나"},
  {"type": "figure", "content": "엄마"},
  {"type": "object", "content": "수건"}
]

Input topology:
[
  {"target 1": "나", "target 2": "엄마", "topology": "beside"},
  {"target 1": "나", "target 2": "수건", "topology": "beside, above"},
  {"target 1": "엄마", "target 2": "수건", "topology": "beside, above"}
]

Expected output:
{
  "elements": [
    {"type": "figure", "content": "나", "position": [1, 2]},
    {"type": "figure", "content": "엄마", "position": [3, 2]},
    {"type": "object", "content": "수건", "position": [2, 2]}
  ]
}

Return only a JSON object with an "elements" field containing the array of grid positions. Use ONLY the elements provided in the input."""

        user_prompt = f"""Elements to place:
{json.dumps(all_elements, ensure_ascii=False, indent=2)}

Topology relationships:
{json.dumps(topology, ensure_ascii=False, indent=2)}

IMPORTANT: The output MUST include ALL elements from both "Elements to place" and "Topology relationships". No elements should be missing."""

        # Retry logic for robust parsing
        for attempt in range(3):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                response = await self.llm.ainvoke(messages)
                result = self.grid_parser.parse(response.content)
                
                # Convert Pydantic result to list of dictionaries for compatibility
                layout = []
                for element in result.elements:
                    layout.append({
                        "type": element.type,
                        "content": element.content,
                        "position": element.position
                    })
                break
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == 2:  # Last attempt
                    print("All attempts failed, returning empty layout")
                    layout = []
                else:
                    await asyncio.sleep(1)  # Wait before retry
        
        # action 정보를 figure에 추가
        action_data = None
        for item in topology:
            if '__action_data' in item:
                action_data = item['__action_data']
                break
        
        if action_data:
            for item in layout:
                if item['type'] == 'figure' and item['content'] in action_data:
                    item['action'] = action_data[item['content']]
        
        return layout 