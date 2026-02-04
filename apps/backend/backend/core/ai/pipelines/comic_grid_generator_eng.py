import json
import asyncio
from backend.utils.environment import get_env_variable, EnvironmentVariables
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage, SystemMessage

_llm_cache = {}
_parser_cache = {}


class StoryElement(BaseModel):
    """Individual story element for comic analysis"""
    panel: str = Field(description="Panel number (1-4)")
    act: str = Field(description="Action or activity (English verb phrase)")
    figure: str = Field(description="Characters involved in the action")
    object: str = Field(description="Physical objects involved (empty string if none)")
    location: str = Field(description="Location where action occurs (empty string if none)")
    think: Optional[str] = Field(default=None, description="Thought content (only for act='thought')")
    tell: Optional[str] = Field(default=None, description="Spoken dialogue (only for act='dialogue')")
    emotion: Optional[str] = Field(default=None, description="Emotion word (only for act='emotion')")


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


class ComicGridGeneratorEng:
    def __init__(self):
        model_key = "gpt-4.1-mini-2025-04-14"
        if model_key not in _llm_cache:
            _llm_cache[model_key] = ChatOpenAI(
                model=model_key,
                temperature=0.2,
                api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY),
                timeout=30
            )
        self.llm = _llm_cache[model_key]

    async def generate_comic_grids(self, panel_contents: Dict[str, str], progress_callback=None) -> Dict[str, Any]:
        """Generate comic grids asynchronously"""
        try:
            comic_generator = FourSceneComicEng(panel_contents)
            return await comic_generator.generate(progress_callback)
        except Exception as e:
            print(f"Error in ComicGridGeneratorEng: {e}")
            return {
                "panel1": {"content": "", "grid": self._create_empty_grid()},
                "panel2": {"content": "", "grid": self._create_empty_grid()},
                "panel3": {"content": "", "grid": self._create_empty_grid()},
                "panel4": {"content": "", "grid": self._create_empty_grid()}
            }

    def _create_empty_grid(self):
        return [[{"type": "empty", "content": "", "position": [x, y]} for x in range(5)] for y in range(5)]


class FourSceneComicEng:
    def __init__(self, panel_contents: Dict[str, str]):
        model_key = "gpt-4.1-mini-2025-04-14"
        if model_key not in _llm_cache:
            _llm_cache[model_key] = ChatOpenAI(
                model=model_key,
                temperature=0.2,
                api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY),
                timeout=30
            )
        self.llm = _llm_cache[model_key]
        self.panels = panel_contents

        if "story_parser_eng" not in _parser_cache:
            _parser_cache["story_parser_eng"] = PydanticOutputParser(pydantic_object=StoryAnalysis)
        if "topology_parser" not in _parser_cache:
            _parser_cache["topology_parser"] = PydanticOutputParser(pydantic_object=TopologyAnalysis)
        if "grid_parser" not in _parser_cache:
            _parser_cache["grid_parser"] = PydanticOutputParser(pydantic_object=GridLayout)

        self.parser = _parser_cache["story_parser_eng"]
        self.topology_parser = _parser_cache["topology_parser"]
        self.grid_parser = _parser_cache["grid_parser"]

    @staticmethod
    def _create_empty_grid():
        return [[{"type": "empty", "content": "", "position": [x, y]} for x in range(5)] for y in range(5)]

    async def _analyze_story(self) -> List[Dict]:
        """Step 1: Story analysis for panels - Structured Output."""
        system_prompt = """You are an expert in information-extraction and comic scene designer. Analyze the comic panels (in English) and extract story elements.

IMPORTANT: You must return a JSON object with an "elements" field containing the array of story elements.

Rules for extraction:

1. Allowed keys (exact spelling, lower-case):
panel, act, figure, object, location, think, tell, emotion

2. Act selection
• If the sentence expresses thought or desire → act:"thought" and fill think with the thought content
  - Use natural English (e.g., "I want to go to the amusement park" → think: "I want to go to the amusement park")
• If the sentence contains speech or dialogue:
  - Extract the spoken content and set act:"dialogue" with tell
  - **CRITICAL: Only assign the dialogue to the person who is actually speaking**
  - **CRITICAL: When multiple people are mentioned, identify the actual speaker**
  - If there's another action in the same sentence, create a separate entry with that action
  Example: "The guard shouted at us to take cover because it was raining hard"
    → {
      "elements": [
        {"panel":"2","act":"dialogue","figure":"Guard","object":"","location":"Park", "tell":"It's raining hard! Take cover!"},
        {"panel":"2","act":"shouted","figure":"Guard","object":"","location":"Park"}
      ]
    }
  Example: "Minsoo asked me where I was going and I said to the store"
    → {
      "elements": [
        {"panel":"3","act":"dialogue","figure":"Minsoo","object":"","location":"", "tell":"Where are you going?"},
        {"panel":"3","act":"dialogue","figure":"Me","object":"","location":"", "tell":"To the store!"}
      ]
    }
• Otherwise, set act to the exact English verb phrase (e.g., kicked, flew, went, walked, hid)
  - Also extract any objects that are part of the action
  - Example: "was playing computer games" → act:"was playing games", object:"Computer"
  - Example: "was reading a book" → act:"was reading", object:"Book"
  - Example: "kicked the soccer ball" → act:"kicked", object:"Soccer ball"

3. Figure and Location extraction
• Always extract the subject of the action as figure
  - Extract ONLY the person/character who is performing the action
  - **CRITICAL: When "we" appears in the text, replace it with the actual character names from context**
  - **CRITICAL: "we" should NEVER appear in the figure field - always use specific character names**
  - Example: "Mom said to me" → figure:"Mom, Me"
  - Example: "I thought that I liked Minsoo" → figure:"Me"
  - Example: "Mom said she loves me" → figure:"Mom"
  - Example: "Mom and I talked" → figure:"Mom, Me"
  - Example: "I found Minsoo" → figure:"Me, Minsoo"
  - Example: "I found the tumbler" → figure:"Me" (tumbler is not a person)
  - Example: "We went out to find the ball" → figure:"Me, Minsoo" (replace "we" with actual characters)
• Extract location ONLY when the action actually happens at that place
  - Correct: "played at the park" → location:"Park"
  - Correct: "ran under the bus stop" → location:"under the bus stop"
  - Incorrect: "the amusement park appeared in my dream" → location:"" (just mentioned)
• When analyzing location with spatial relations (under, above, beside, in front of, behind), treat the reference object as both object and location
• When an action involves multiple figures (subject and object), include all in the figure field
  Example: "I pushed Yongho" → figure:"Me, Yongho", act:"pushed"
  Example: "The teacher caught me" → figure:"Teacher, Me", act:"caught"

4. Object selection
• Only physical objects that can be seen or touched should be listed as objects
• Do not treat actions or verbs as objects
• Do not treat spoken words or dialogue as objects
• Do not treat location names as objects
• IMPORTANT: Spoken, thought, emotion content (tell, think, emotion) should NEVER be treated as object
• Examples of objects: soccer ball, chair, book, bag, notebook
• Examples of what are NOT objects: jump, run, walk, run

5. One panel may contain multiple actions; output one object per action, all with the same panel value.

6. Preserve every English word exactly as written in the panels.

7. For any empty value, write an empty string "".

8. Respond with valid structured output only—no explanations, comments, or extra keys.

Below is a worked example; follow the same schema

Example 1:
panel1: "I took a walk with Mom near home."
panel2: "I started wanting to go to the amusement park."
panel3: "So I told Mom I wanted to go to the amusement park and Mom said let's go."
panel4: "I was happy."

Expected elements (English):
[
{"panel":"1","act":"took a walk","figure":"Me, Mom","object":"","location":"Near home"},
{"panel":"2","act":"thought","figure":"Me","object":"","location":"Near home","think":"I want to go to the amusement park"},
{"panel":"3","act":"dialogue","figure":"Me","object":"","location":"Near home","tell":"I want to go to the amusement park!"},
{"panel":"3","act":"dialogue","figure":"Mom","object":"","location":"Near home","tell":"Okay, let's go!"},
{"panel":"4","act":"emotion","figure":"Me","object":"","location":"","emotion":"Happy"}
]

Example 2:
panel1: "I kicked the soccer ball with Minsoo on the school playground."
panel2: "The ball went over the fence when Minsoo went 'Oh!'"
panel3: "We went outside the fence to find the ball."
panel4: "I was happy."

Expected elements:
[
{"panel":"1","act":"kicked","figure":"Me, Minsoo","object":"Soccer ball","location":"School playground"},
{"panel":"2","act":"dialogue","figure":"Minsoo","object":"","location":"","tell":"Oh!"},
{"panel":"2","act":"went over","figure":"","object":"Soccer ball","location":"Beyond the fence"},
{"panel":"3","act":"went","figure":"Me, Minsoo","object":"","location":"Beyond the fence"},
{"panel":"3","act":"found","figure":"Me, Minsoo","object":"Soccer ball","location":"Outside the fence"},
{"panel":"4","act":"emotion","figure":"Me","object":"","location":"","emotion":"Happy"}
]

Example 3:
panel1: "I was giving a gift to my friend at the park."
panel2: "Suddenly, the guard shouted at us to take cover because it was raining hard."
panel3: "We ran quickly to the bus stop to avoid the rain."
panel4: "I got wet and angry."

Expected elements:
[
{"panel":"1","act":"was giving a gift","figure":"Me, Friend","object":"","location":"Park"},
{"panel":"2","act":"dialogue","figure":"Guard","object":"","location":"Park", "tell":"It's raining hard! Take cover!"},
{"panel":"2","act":"shouted","figure":"Guard","object":"","location":"Park"},
{"panel":"3","act":"ran","figure":"Me, Friend","object":"","location":""},
{"panel":"3","act":"avoid","figure":"Me, Friend","object":"Rain","location":"Bus stop"},
{"panel":"4","act":"emotion","figure":"Me","object":"","location":"","emotion":"Angry"}
]
**Note: In this example, "We" in panel2 and panel3 refers to "Me, Friend" based on the context from panel1.**
"""

        user_prompt = f'''Convert the new panels that follow.
Panel 1: "{self.panels.get("panel1", "")}"
Panel 2: "{self.panels.get("panel2", "")}"
Panel 3: "{self.panels.get("panel3", "")}"
Panel 4: "{self.panels.get("panel4", "")}"
'''

        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                response = await self.llm.ainvoke(messages)
                content = response.content.strip()
                # LLM sometimes returns a raw JSON array instead of {"elements": [...]}; normalize for parser
                try:
                    raw = json.loads(content)
                    if isinstance(raw, list):
                        content = json.dumps({"elements": raw})
                except json.JSONDecodeError:
                    pass
                result = self.parser.parse(content)
                story_elements = []
                for element in result.elements:
                    d = element.model_dump()
                    d["panel"] = str(d.get("panel", ""))
                    story_elements.append(d)
                print(f"Story Analysis Result: {json.dumps(story_elements, ensure_ascii=False, indent=2)}")
                return story_elements
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed, returning empty result")
                    return []
                await asyncio.sleep(1)

    async def generate(self, progress_callback=None) -> Dict[str, Any]:
        """Generate comic panels with grid layouts (English progress messages)."""
        try:
            if progress_callback:
                await progress_callback(20, "Thinking about how to draw~")
            story_analysis = await self._analyze_story()

            if progress_callback:
                await progress_callback(40, "Okay! I'll draw it like this!")
            result = {}
            for i, panel_id in enumerate(["panel1", "panel2", "panel3", "panel4"]):
                panel_content = self.panels.get(panel_id, "")
                if panel_content and panel_content.strip():
                    if progress_callback:
                        await progress_callback(60 + (i * 10), f"Drawing panel {i + 1}~")

                    panel_num = panel_id.replace("panel", "")
                    panel_elements = [elem for elem in story_analysis if elem.get("panel") == panel_num]

                    place = ""
                    for elem in panel_elements:
                        if elem.get("location"):
                            place = elem["location"]
                            break

                    grid_layout = await self._determine_topology(panel_id, story_analysis)
                    result[panel_id] = {
                        "content": panel_content,
                        "place": place,
                        "grid": grid_layout
                    }
                else:
                    if progress_callback:
                        await progress_callback(60 + (i * 10), f"Processing panel {i + 1}~")
                    result[panel_id] = {
                        "content": "",
                        "place": "",
                        "grid": []
                    }

            if progress_callback:
                await progress_callback(100, "Done!")
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
        """Step 2: Determine topology for panel."""
        try:
            panel_num = panel_id.replace("panel", "")
            panel_elements = [elem for elem in story_analysis if elem.get("panel") == panel_num]

            topology = await self._get_topology_relationships(panel_id, panel_elements)
            print(f"Topology for panel {panel_id}: {json.dumps(topology, ensure_ascii=False, indent=2)}")

            layout = await self._determine_grid_positions(topology, panel_elements)
            return layout
        except Exception as e:
            print(f"Error determining topology for {panel_id}: {e}")
            import traceback
            traceback.print_exc()
            return []

    async def _get_topology_relationships(self, panel_id: str, panel_elements: List[Dict]) -> List[Dict]:
        """Determine topology relationships."""
        if not panel_elements:
            return []

        filtered_elements = []
        for element in panel_elements:
            filtered_element = element.copy()
            if "location" in filtered_element:
                filtered_element["location"] = ""
            filtered_elements.append(filtered_element)

        system_prompt = """You are a comic panel topology designer that determines core relationships between figures and objects.

Input  : One panel's semantic JSON objects (English)
Output : A JSON object with a "relationships" field containing an array where every relevant pair is represented by an object with spatial relationship (topology).
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

JUDGMENT RULES (English acts)
1. act hints at positions
   - "kicked/hit with foot" → figure ↔ object: beside, below
   - "threw/flew" → figure → object: below; object → obstacle: above
   - "took cover/hid" → figure → shelter: above; shelter → threat: below
2. location can add background elements
   - "beyond A" means object is below A, A is above object
   - "under A" means figure is above A, A is below figure
   - "hid under A" → figure → A: above (figure is under A)
   - "climbed on A" → figure → A: below (figure is on top of A)
3. dialogue / tell / thought / think / emotion
   - Create "speech" for tell, "thought" for think, "emotion" for emotion
   - Speaker ↔ balloon/cloud/emotion: beside, below, above (all apply)
4. Multiple figures default to beside unless text says otherwise
5. If multiple objects exist, output every unordered pair exactly once
6. When location contains spatial relationships (under, above, beside, in front of, behind), treat the reference object as a separate element
   - "above A" → treat "A" as an object element
   - "beside A" → treat "A" as an object element
   - "in front of A" → treat "A" as an object element
   - "behind A" → treat "A" as an object element

Below is a worked example; follow the same schema.

EXAMPLE 1
INPUT
{"panel":"1","act":"kicked","figure":"Me, Minsoo","object":"Soccer ball","location":"School playground"}
OUTPUT
{
  "relationships": [
    {"target_1":"Me","target_2":"Minsoo","topology":"beside"},
    {"target_1":"Me","target_2":"Soccer ball","topology":"beside, below"},
    {"target_1":"Minsoo","target_2":"Soccer ball","topology":"beside, below"}
  ]
}

EXAMPLE 2  
INPUT  
{"panel":"2","act":"dialogue","figure":"Minsoo","object":"","location":"","tell":"Oh!"},
{"panel":"2","act":"flew","figure":"","object":"Soccer ball","location":"Beyond the fence"}  
OUTPUT  
{
  "relationships": [
    {"target_1":"Minsoo","target_2":"Oh!","topology":"beside, below, above"},
    {"target_1":"Fence","target_2":"Soccer ball","topology":"above"},
    {"target_1":"Minsoo","target_2":"Fence","topology":"apart"}
  ]
}

EXAMPLE 2-2
INPUT  
{"panel":"4","act":"emotion","figure":"Me","object":"","location":"","emotion":"Excited"}
OUTPUT  
{
  "relationships": [
    {"target_1":"Me","target_2":"Excited","topology":"beside, below, above"}
  ]
}

EXAMPLE 3
INPUT
{"panel":"3","act":"took cover","figure":"Me, Friend","object":"Rain","location":"Under the bus stop"}
OUTPUT
{
  "relationships": [
    {"target_1":"Me, Friend","target_2":"Bus stop","topology":"above"},
    {"target_1":"Bus stop","target_2":"Rain","topology":"above"}
  ]
}

EXAMPLE 4
INPUT  
{"panel":"2","act":"hid","figure":"Me","object":"","location":"Under the chair"}
OUTPUT  
{
  "relationships": [
    {"target_1":"Me","target_2":"Chair","topology":"above"},
    {"target_1":"Chair","target_2":"Me","topology":"below"}
  ]
}
"""

        user_prompt = f"""Convert below elements to the topology:
Input elements for panel {panel_id}:
{json.dumps(filtered_elements, ensure_ascii=False, indent=2)}"""

        for attempt in range(3):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                response = await self.llm.ainvoke(messages)
                result = self.topology_parser.parse(response.content)
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
                if attempt == 2:
                    print("All attempts failed, returning empty topology")
                    topology = []
                else:
                    await asyncio.sleep(1)

        processed_tell_contents = set()
        processed_think_contents = set()
        processed_emotion_contents = set()
        action_data = {}

        for rel in topology:
            target1_content = str(rel.get("target 1", ""))
            target2_content = str(rel.get("target 2", ""))

            for elem in panel_elements:
                if elem.get("figure"):
                    figures = elem["figure"].split(", ")

                    if target1_content in figures:
                        if elem.get("tell"):
                            processed_tell_contents.add(elem["tell"])
                            if target1_content not in action_data:
                                action_data[target1_content] = []
                            if not any(a["type"] == "tell" and a["content"] == elem["tell"] for a in action_data[target1_content]):
                                action_data[target1_content].append({"type": "tell", "content": elem["tell"]})
                        if elem.get("think"):
                            processed_think_contents.add(elem["think"])
                            if target1_content not in action_data:
                                action_data[target1_content] = []
                            if not any(a["type"] == "think" and a["content"] == elem["think"] for a in action_data[target1_content]):
                                action_data[target1_content].append({"type": "think", "content": elem["think"]})
                        if elem.get("emotion"):
                            processed_emotion_contents.add(elem["emotion"])
                            if target1_content not in action_data:
                                action_data[target1_content] = []
                            if not any(a["type"] == "emotion" and a["content"] == elem["emotion"] for a in action_data[target1_content]):
                                action_data[target1_content].append({"type": "emotion", "content": elem["emotion"]})

                    if target2_content in figures:
                        if elem.get("tell"):
                            processed_tell_contents.add(elem["tell"])
                            if target2_content not in action_data:
                                action_data[target2_content] = []
                            if not any(a["type"] == "tell" and a["content"] == elem["tell"] for a in action_data[target2_content]):
                                action_data[target2_content].append({"type": "tell", "content": elem["tell"]})
                        if elem.get("think"):
                            processed_think_contents.add(elem["think"])
                            if target2_content not in action_data:
                                action_data[target2_content] = []
                            if not any(a["type"] == "think" and a["content"] == elem["think"] for a in action_data[target2_content]):
                                action_data[target2_content].append({"type": "think", "content": elem["think"]})
                        if elem.get("emotion"):
                            processed_emotion_contents.add(elem["emotion"])
                            if target2_content not in action_data:
                                action_data[target2_content] = []
                            if not any(a["type"] == "emotion" and a["content"] == elem["emotion"] for a in action_data[target2_content]):
                                action_data[target2_content].append({"type": "emotion", "content": elem["emotion"]})

        filtered_topology = []
        for rel in topology:
            filtered_rel = rel.copy()
            target1_content = str(rel.get("target 1", ""))
            target2_content = str(rel.get("target 2", ""))

            if target1_content in processed_tell_contents or target1_content in processed_think_contents or target1_content in processed_emotion_contents:
                filtered_rel["target 1"] = None
            if target2_content in processed_tell_contents or target2_content in processed_think_contents or target2_content in processed_emotion_contents:
                filtered_rel["target 2"] = None
            filtered_topology.append(filtered_rel)

        filtered_topology.append({"__action_data": action_data})
        return filtered_topology

    async def _determine_grid_positions(self, topology: List[Dict], elements: List[Dict]) -> List[Dict]:
        """Determine grid positions (same logic as KR; content-agnostic)."""
        element_set = set()
        all_elements = []

        def add_element(type_name: str, content: str):
            key = f"{type_name}:{content}"
            if key not in element_set:
                element_set.add(key)
                all_elements.append({"type": type_name, "content": content})

        for element in elements:
            if element.get("figure"):
                for figure in element["figure"].split(", "):
                    add_element("figure", figure.strip())
            if element.get("object"):
                add_element("object", element["object"])

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
  {"type": "figure", "content": "Me"},
  {"type": "figure", "content": "Minsoo"},
  {"type": "object", "content": "Bus stop"}
]

Input topology:
[
  {"target 1": "나", "target 2": "Minsoo", "topology": "beside"},
  {"target 1": "Me", "target 2": "Speech", "topology": "beside, below"},
  {"target 1": "Me", "target 2": "Bus stop", "topology": "above"},
  {"target 1": "Minsoo", "target 2": "Bus stop", "topology": "above"}
]

Expected output:
{
  "elements": [
    {"type": "figure", "content": "Me", "position": [2, 2]},
    {"type": "figure", "content": "Minsoo", "position": [3, 2]},
    {"type": "object", "content": "Bus stop", "position": [2, 1]},
    {"type": "object", "content": "Bus stop", "position": [3, 1]}
  ]
}

Example 2:
Input elements:
[
  {"type": "figure", "content": "Me"},
  {"type": "figure", "content": "Mom"},
  {"type": "object", "content": "Towel"}
]

Input topology:
[
  {"target 1": "Me", "target 2": "Mom", "topology": "beside"},
  {"target 1": "Me", "target 2": "Towel", "topology": "beside, above"},
  {"target 1": "Mom", "target 2": "Towel", "topology": "beside, above"}
]

Expected output:
{
  "elements": [
    {"type": "figure", "content": "Me", "position": [1, 2]},
    {"type": "figure", "content": "Mom", "position": [3, 2]},
    {"type": "object", "content": "Towel", "position": [2, 2]}
  ]
}

Return only a JSON object with an "elements" field containing the array of grid positions. Use ONLY the elements provided in the input."""

        user_prompt = f"""Elements to place:
{json.dumps(all_elements, ensure_ascii=False, indent=2)}

Topology relationships:
{json.dumps(topology, ensure_ascii=False, indent=2)}

IMPORTANT: The output MUST include ALL elements from both "Elements to place" and "Topology relationships". No elements should be missing."""

        for attempt in range(3):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                response = await self.llm.ainvoke(messages)
                result = self.grid_parser.parse(response.content)
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
                if attempt == 2:
                    print("All attempts failed, returning empty layout")
                    layout = []
                else:
                    await asyncio.sleep(1)

        action_data = None
        for item in topology:
            if "__action_data" in item:
                action_data = item["__action_data"]
                break

        if action_data:
            for item in layout:
                if item["type"] == "figure" and item["content"] in action_data:
                    item["action"] = action_data[item["content"]]

        return layout
