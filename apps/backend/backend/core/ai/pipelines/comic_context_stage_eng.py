from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import *
from backend.database.crud.chatbot import update_journal_entry_stage, update_comic_panels, update_comic_data, update_comic_status
from backend.database.crud.chatbot import get_messages_by_journal_entry_and_stage
from backend.database.models import JournalEntryStage, MessageRole
from backend.utils.i18n import t
from backend.utils.korean import append_josa
from backend.core.ai.pipelines.revision_2_stage_eng import Revision2StageEng
from sqlmodel import Session
import json
import openai
import os
import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession

# LLM instance cache
_llm_cache = {}
_parser_cache = {}

class PanelAnalysis(BaseModel):
    """Panel analysis result"""
    A: List[str] = Field(description="Panel 1 (Antecedent) issues")
    B: List[str] = Field(description="Panel 2 (Behavior) issues")
    C: List[str] = Field(description="Panel 3 (Consequence) issues")
    D: List[str] = Field(description="Panel 4 (Emotion) issues")

class StoryFlowAnalysis(BaseModel):
    """Complete story flow analysis"""
    content: PanelAnalysis = Field(description="Content analysis for each panel")
    order: List[str] = Field(description="Order issues that need to be resolved")

class PanelReconstruction(BaseModel):
    """Panel reconstruction result"""
    panel1: Optional[str] = Field(description="Panel 1 content")
    panel2: Optional[str] = Field(description="Panel 2 content")
    panel3: Optional[str] = Field(description="Panel 3 content")
    panel4: Optional[str] = Field(description="Panel 4 content")

class QuestionData(BaseModel):
    """Question generation data"""
    question: str = Field(description="Generated question")
    intent: str = Field(description="Question intent")
    focus_panel: Optional[str] = Field(description="Panel to focus on")

class NextQuestionData(BaseModel):
    """Next question generation data"""
    question: str = Field(description="Generated follow-up question")
    focused_panel: Optional[str] = Field(description="Panel to focus on")

@dataclass
class ComicPanel:
    """Comic panel data structure"""
    content: Optional[str]
    missing_content: Optional[str] = None

class ComicContextStageEng:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = None
        self.child_age = None
        self.child_gender = None
        self.agent_name = None
        self.agent_interests = None
        self.story_analysis = None
        self.final_comic_generation_started = False
        self.current_panels = None
        
        # LangChain setup (cached instance)
        model_key = "gpt-4.1-mini-2025-04-14"
        if model_key not in _llm_cache:
            _llm_cache[model_key] = ChatOpenAI(
                model=model_key,
                temperature=0.1,
                api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY),
                timeout=20 
            )
        self.llm = _llm_cache[model_key]
        
        # Parser
        if "flow_parser" not in _parser_cache:
            _parser_cache["flow_parser"] = PydanticOutputParser(pydantic_object=StoryFlowAnalysis)
        if "reconstruction_parser" not in _parser_cache:
            _parser_cache["reconstruction_parser"] = PydanticOutputParser(pydantic_object=PanelReconstruction)
        if "question_parser" not in _parser_cache:
            _parser_cache["question_parser"] = PydanticOutputParser(pydantic_object=QuestionData)
        if "next_question_parser" not in _parser_cache:
            _parser_cache["next_question_parser"] = PydanticOutputParser(pydantic_object=NextQuestionData)
        
        self.flow_parser = _parser_cache["flow_parser"]
        self.reconstruction_parser = _parser_cache["reconstruction_parser"]
        self.question_parser = _parser_cache["question_parser"]
        self.next_question_parser = _parser_cache["next_question_parser"]
    
    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'ComicContextStageEng':
        instance = cls(db, journal_entry_id)
        
        dyad_info = await instance._get_dyad_info()
        instance.child_name = dyad_info[0]
        instance.child_age = dyad_info[1]
        instance.child_gender = dyad_info[2]
        instance.agent_name = dyad_info[3]
        instance.agent_interests = dyad_info[4]
        
        journal = await get_journal(db, journal_entry_id)
        if journal and journal.comic_context:
            instance.current_panels = journal.comic_context
        return instance
    
    async def _get_dyad(self) -> Dyad:
        """Get dyad info."""
        from backend.database.crud.chatbot import get_journal_entry
        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        return journal_entry.dyad if journal_entry and journal_entry.dyad else None

    async def _get_dyad_info(self) -> tuple[str, int, str, str, list[str]]:
        """Get dyad info (child_name, child_age, child_gender, agent_name, agent_interests)."""
        dyad = await self._get_dyad()
        if not dyad:
            return "User", 15, "male", "Dodo", ["Dinosaurs", "Counting things", "Talking to himself"]

        child_name = dyad.child_name or "User"
        child_age = dyad.child_age or 15
        child_gender = dyad.child_gender or "male"
        agent_name = "Dodo"
        agent_interests = ["Dinosaurs", "Counting things", "Talking to himself"]

        if dyad.agents:
            agent_name = dyad.agents[0].agent_name or "Dodo"
            interests = []
            for agent in dyad.agents:
                if agent.interest:
                    interests.append(agent.interest)
            if interests:
                agent_interests = interests
        
        return child_name, child_age, child_gender, agent_name, agent_interests
    
    async def _get_child_name(self) -> str:
        """Get dyad child_name."""
        return (await self._get_dyad_info())[0]
    
    async def _get_child_age(self) -> int:
        """Get dyad child_age."""
        return (await self._get_dyad_info())[1]
    
    async def _get_agent_name(self) -> str:
        """Get agent agent_name."""
        return (await self._get_dyad_info())[3]
    
    async def _get_agent_interests(self) -> list[str]:
        """Get agent interest list."""
        return (await self._get_dyad_info())[4]
    
    async def _get_child_gender(self) -> str:
        """Get dyad child_gender."""
        return (await self._get_dyad_info())[2]
    
    def _check_issues(self, story_analysis: Dict[str, Any]) -> tuple[bool, bool]:
        """Check content and order issues."""
        content_issues = story_analysis.get("content", {})
        order_issues = story_analysis.get("order", [])
        
        # Content issue check
        content_has_issues = [
            content_issues.get("A", []),
            content_issues.get("B", []),
            content_issues.get("C", []),
            content_issues.get("D", [])
        ]
        
        has_content_issues = any(
            any(issue.strip() for issue in issues if issue.strip())
            for issues in content_has_issues
        )
        
        # Order issue check
        has_order_issues = any(
            order.strip() for order in order_issues if order.strip()
        )
        
        return has_content_issues, has_order_issues
    
    def get_character_background(self) -> str:
        """Build character background"""
        return f"""[Character Background]
You are a {self.child_age}-year-old middle school student named {self.agent_name}.
You're having a friendly conversation with your autistic best friend, {self.child_name} (also {self.child_gender}).

{self.child_name}'s special interests:
{chr(10).join([f"- {interest}" for interest in self.agent_interests])}

[General Speaking Rules]
1. Use informal English like talking to a peer friend. Do not use honorifics.
2. Keep responses short and simple - one or two sentences maximum.
3. Use emojis appropriately.
4. Ask only one question per turn.
5. Never apologize or say sorry.
6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
7. If the user brings up special interests, show interest but gently guide back to the main topic.
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, then you can say, "I don't know," and go back to the conversation topic.
"""
        
    async def start_context_analysis(self) -> Message:
        """Start comic context analysis"""
        try:
            # Journal entry stage update
            await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
            
            # Create new interaction turn
            interaction_turn = await create_interaction_turn(
                self.db, self.journal_entry_id, JournalEntryStage.ComicContext
            )
            
            # Create first analysis question
            initial_question, intent, focused_panel = await self._generate_first_question()
            
            # Include focus panel information in metadata
            metadata_json = {}
            if focused_panel:
                metadata_json["focused_panel"] = focused_panel
                print(f"[DEBUG] comic_context: start_context_analysis focused_panel = {focused_panel}")
            
            message = await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                initial_question, MessageRole.Assistant, JournalEntryStage.ComicContext,
                intent=intent,
                metadata_json=metadata_json
            )
            
            return message
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in start_context_analysis: {e}")
            raise
    
    async def process_message(self, user_message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """Process user message - Structured Output"""
        print(f"[DEBUG] comic_context: process_message called with user_message='{user_message}'")
        try:
            # Get current interaction turn
            interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.ComicContext)
            
            # Save user message (include audio_filename)
            await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                user_message, MessageRole.User, JournalEntryStage.ComicContext,
                audio_filename=audio_filename,
                intent=intent
            )
            
            # If first message, perform analysis
            print(f"[DEBUG] comic_context: story_analysis = {self.story_analysis}")
            
            # Check if existing comic_context in database
            journal = await get_journal(self.db, self.journal_entry_id)
            has_existing_context = journal and journal.comic_context
            
            if not self.story_analysis and not has_existing_context:
                # First message: analysis then reconstruction
                self.story_analysis = await self._analyze_story_flow()
                print(f"[DEBUG] comic_context: story_analysis created: {self.story_analysis}")
                await self._reconstruct_panel(user_message, "", True)
            else:
                # After message: reconstruction then analysis update
                await self._reconstruct_panel(user_message, "user input", False)
                self.story_analysis = await self._analyze_story_flow()
                print(f"[DEBUG] comic_context: story_analysis updated: {self.story_analysis}")


            # Check completion
            if self.is_complete() or "go to the next phase" in user_message.lower():
                child_name = await self._get_child_name()
                dyad = await self._get_dyad()
                response_message = t('Journaling.Messages.ComicContextComplete', dyad.locale).format(
                    child_name=child_name
                )
                response_intent = MessageIntent.StartComicGeneration

                message = await create_message(
                    self.db, self.journal_entry_id, interaction_turn.id,
                    response_message, MessageRole.Assistant, JournalEntryStage.ComicContext,
                    intent=response_intent
                )
            
                return message
            else:
                # Create Next Question
                next_question, next_intent, focused_panel = await self._get_next_question()
                
                # Include focus panel information in metadata
                metadata_json = {}
                if focused_panel:
                    metadata_json["focused_panel"] = focused_panel
                    print(f"[DEBUG] comic_context: focused_panel = {focused_panel}")
                
                # Save bot response
                message = await create_message(
                    self.db, self.journal_entry_id, interaction_turn.id,
                    next_question, MessageRole.Assistant, JournalEntryStage.ComicContext,
                    intent=next_intent,
                    metadata_json=metadata_json
                )
                
                return message
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in process_message: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    async def _analyze_story_flow(self) -> Dict[str, Any]:
        """Analyze story flow - Structured Output"""
        journal = await get_journal(self.db, self.journal_entry_id)
        if not journal:
            return {"content": {"A": [], "B": [], "C": [], "D": []}, "order": []}
        
        # Use latest panel state in memory
        if self.current_panels:
            panels_content = self.current_panels
        else:
            # If not in memory, get from database
            panels_content = journal.comic_context if journal.comic_context else journal.revision_1
            
        if not panels_content:
            return {"content": {"A": [], "B": [], "C": [], "D": []}, "order": []}
        
        system_prompt = """You are "ABCD-Diary Reviewer."

────────────────────
INPUT (always 4 lines)
────────────────────
panel1  = A - Antecedent   // where, who, situation (time optional)
panel2  = B - Behavior     // observable action, how / how long / with what
panel3  = C - Consequence  // factual outcome or others' reaction right after B
panel4  = D - Emotion      // writer's own feeling only (emotion word) - NEVER others' emotions

────────────────────
YOUR TASK
────────────────────
1. Read the four lines EXACTLY as provided.
2. Determine if this is a PROBLEMATIC or NORMAL situation:
   - PROBLEMATIC: scolding, crying, fighting, getting hurt, being embarrassed, etc.
   - NORMAL: playing, eating, studying, visiting places, etc.

3. Analyze each category (A, B, C, D) and separate issues into TWO categories:

   **CONTENT ISSUES** (missing information):
   • Required info present?
     – If essential details are absent or null, specify what is missing and give a short example.  
       (For A, do not flag missing time unless the scene is confusing without it.)
   • **FLOW ANALYSIS:**
     – A→B Flow: Does panel A provide sufficient context for panel B to make sense?
     – B→C Flow: Does panel B provide sufficient action/behavior for panel C to be a logical consequence?
     – If flow is broken, specify what's missing to connect the panels logically

   **ORDER ISSUES** (content in wrong panel):
   • Category purity kept?
     – If the line contains data that belongs to another category, specify exactly which part should move:  
       "B content in C: 'I hid' should move to B, keep 'Amy found me' in C"
     – **CRITICAL: Only flag content that is CLEARLY in the wrong category**
     – **CRITICAL: If content is already in the correct category, do NOT suggest moving it**
      - If content naturally fits in its current panel, do NOT suggest moving it
      - Behavior content (actions) belongs in B, even if it includes some context
      - Consequence content (results/reactions) belongs in C, even if it includes some context
      - Do NOT split content unnecessarily - if it flows naturally, keep it together
   • **CRITICAL TIMELINE RULE:**
     • Even if content describes behavior/action, if it happened AFTER the C panel events, it should be added to C panel, not B panel
     • C panel can contain multiple sequential events that happened after the main action in B panel
     • Example: If C panel is "My mom praised me" and then "I go to bed" happened after, "I go to bed" goes in C panel, not B panel
     • In this case, do not flag order issue.

   *Required sub-details*  
     A : place / people / background situation
     B : concrete action, method‧tools  
     C : immediate factual result or a near-future plan that was directly agreed as a result of B or existing character's response (avoid introducing new characters)
     D : pure emotion word (intensity optional)

   **CRITICAL: When asking about C (Consequence), focus on WHAT HAPPENED NEXT, not HOW the action was done**
   - If B already describes the result (e.g., "I didn't fall"), ask about the NEXT action or response
   - Examples:
     - B: "I didn't fall" → C: Ask "What did you do next?" (continue riding, stop and thank, etc.)
     - B: "I stopped the bike" → C: Ask "What happened after stopping?" (thanked, continued, etc.)
   - Do NOT ask "How did you do it?" when the result is already clear

   **FLOW REQUIREMENTS:**
     A→B Flow: A must provide context (where/who) that makes B's action logical
     B→C Flow: B must provide action that logically leads to C's result/reaction
     If flow is broken, identify what's missing to connect the panels

4. QUESTION FOCUS based on situation type:
   - PROBLEMATIC situations: Focus on "WHY" questions (causes, reasons)
   - NORMAL situations: Focus on "HOW" questions (methods, details)

────────────────────
OUTPUT (structured output)
────────────────────
Analyze the panels and provide structured output with content issues and order issues.

────────────────────
MANDATORY RULES
────────────────────
• **CRITICAL: Analyze ONLY the exact content provided in each panel**
• **CRITICAL: Do NOT invent or assume content that is not present**
• **CRITICAL: Do NOT flag content that is already present in the panel, even if phrased differently**
• **CRITICAL: Focus on truly missing information, not rephrasing of existing content**
• **CRITICAL: content array contains ONLY missing information issues**
• **CRITICAL: order array contains ONLY content separation instructions**
• **CRITICAL: When content needs to be separated, use exact format "X content in Y: 'text' should move to X, keep 'text' in Y"**
• **CRITICAL: Only suggest moving content when it is CLEARLY in the wrong category**
• **CRITICAL: If content fits naturally in its current panel, leave it there**
• **CRITICAL: Panel D should ONLY contain the writer's own emotions, not others' emotions**
• **CRITICAL: Do NOT suggest moving content that is already in the correct panel**
• **CRITICAL: Do NOT create order issues for content that is properly categorized**
• **CRITICAL: Before creating any order issue, verify that the content actually exists in the specified panel**
• **CRITICAL: If you cannot find the exact content mentioned in an order issue, do NOT create that order issue**
• **CRITICAL: Only create order issues for content that is CLEARLY misplaced**
• Produce nothing except the single JSON block.

────────────────────
EXAMPLES
────────────────────

# Example 1
Input  
"panel1": "Minsu and I did a mackerel dissection show at school.",  
"panel2": null,  
"panel3": "I cut off the head, opened the belly, and put the organs into a bag.",  
"panel4": null

Output  
{
  "situation_type": "normal",
  "content": {
    "A": ["Background situation missing — e.g. 'During break time'"],
    "B": [""],
    "C": ["Result missing — e.g. 'Minsoo laughed and said 'Wow''"],
    "D": ["Emotion missing — e.g. 'I was happy'"]
  },
  "order": [
    "B content in C: 'I cut off the head, opened the belly, and put the organs into a bag' should move to B, keep '' in C"
  ]
}

# Example 2 
Input  
"panel1": "I told my mom that I want to go to the amusement park.",  
"panel2": "Mom said, 'Okay, let's go.'",  
"panel3": "We are going to ride a roller coaster next Saturday.",  
"panel4": "I was nervous."

Output  
{
  "situation_type": "normal",
  "content": {
    "A": ["Location missing — e.g. 'At home'"],
    "B": [""],
    "C": [""],                    
    "D": [""]
  },
  "order": []
}

# Example 3 - Flow Analysis
Input  
"panel1": "I walked down the hallway at school.",  
"panel2": "Sohyun suddenly blocked me and started crying.",  
"panel3": null,  
"panel4": "I was nervous and sweaty."

Output
{
  "situation_type": "problematic",
  "content": {
    "A": [""],
    "B": ["Reason for crying missing — e.g. 'I bumped into her accidentally'"],
    "C": ["C missing — e.g. 'Sohyun kept crying and didn't move'"],
    "D": [""]
  },
  "order": []
}

# Example 4 - Content Separation
Input  
"panel1": "I played hide-and-seek with my friends at the playground.",  
"panel2": "",  
"panel3": "I hid behind a tree, but Minsu found me.",  
"panel4": "I was happy."

Output
{
  "situation_type": "normal",
  "content": {
    "A": [""],
    "B": ["B missing - e.g. 'I hid behind a tree'"],
    "C": [""],
    "D": [""]
  },
  "order": [
    "B content in C: 'I hid behind a tree' should move to B, keep 'but Minsu found me' in C"
  ]
}

# Example 5 - D Content in C Separation
Input  
"panel1": "I made pizza with my mom.",  
"panel2": "I kneaded the dough and added the toppings.",  
"panel3": "Mom praised me and I was happy and excited.",  
"panel4": null

Output
{
  "situation_type": "normal",
  "content": {
    "A": [""],
    "B": [""],
    "C": [""],
    "D": ["Emotion missing — e.g. 'I was happy'"]
  },
  "order": [
    "D content in C: 'I was happy and excited' should move to D, keep 'Mom praised me' in C"
  ]
}"""

        user_prompt = f"""Analyze Below Panels:
"panel1": "{panels_content.get('panel1', 'null')}",
"panel2": "{panels_content.get('panel2', 'null')}",
"panel3": "{panels_content.get('panel3', 'null')}",
"panel4": "{panels_content.get('panel4', 'null')}"
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
                result = self.flow_parser.parse(response.content)
                
                # Convert to dict format for compatibility
                analysis_result = {
                    "content": {
                        "A": result.content.A,
                        "B": result.content.B,
                        "C": result.content.C,
                        "D": result.content.D
                    },
                    "order": result.order
                }
                
                print(f"Story Flow Analysis Result: {json.dumps(analysis_result, ensure_ascii=False, indent=2)}")
                return analysis_result
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed, returning empty result")
                    return {"content": {"A": [], "B": [], "C": [], "D": []}, "order": []}
                await asyncio.sleep(1)  # Brief delay before retry
    
    async def _reconstruct_panel(self, answer: str, question: str, add_to_history: bool = True) -> None:
        """Reconstruct panel - Structured Output"""
        if not self.story_analysis:
            self.story_analysis = await self._analyze_story_flow()
        
        journal = await get_journal(self.db, self.journal_entry_id)
        if not journal:
            return
        
        system_prompt = """You are a rewriting engine that fixes 4-panel diary drafts written in first-person English past tense based on the user's answer and order instructions.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation 
- B (panel2): Behavior - observable action, how/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

**CRITICAL TIMELINE RULE:**
- Even if content describes behavior/action, if it happened AFTER the C panel events, it should be added to C panel, not B panel
- C panel can contain multiple sequential events that happened after the main action in B panel
- Example: If B panel is "I played soccer" and then "I went home" happened after, "I went home" goes in C panel, not B panel

**CRITICAL TASK ORDER - YOU MUST FOLLOW THIS SEQUENCE:**

**STEP 1: CONTENT REORGANIZATION (FIRST PRIORITY)**
1. **Process ALL order instructions FIRST before adding new information**
2. **Move content between panels according to order array:**
   • If order says "B content in C: 'I hid' should move to B, keep 'but Minsoo found me' in C"
   • Then: Move "I hid" to panel2 (B), keep "but Minsoo found me" in panel3 (C)
   • If order says "D content in C: 'I felt happy' should move to D, keep 'Mom praised me' in C"
   • Then: Move "I felt happy" to panel4 (D), keep "Mom praised me" in panel3 (C)
   • **CRITICAL: Extract the exact text mentioned in quotes from order array and move it**
   • **CRITICAL: When moving content, merge with existing content in the target panel**

**STEP 2: ADD NEW INFORMATION (SECOND PRIORITY)**
1. **After reorganization, add new information from user's answer:**
   • **CRITICAL: Interpret simple answers like "Yes" based on the question context:**
     - **YES/NO QUESTIONS: When question asks "Did you do ~?" and answer is "Yes" → interpret as "YES, that happened"**
     - **CHOICE QUESTIONS: When question provides choices and answer is "1"/"2"/"3" → interpret as the selected choice**
     - **CONTEXT-BASED INTERPRETATION: Extract the specific information from the question that the user is confirming**
     - **CRITICAL: For "Yes" answers, extract the COMPLETE action from the question including the subject:**
     - **EXAMPLES:**
       - Q: "Did you do it at home?" A: "Yes" → "I did it at home." (At home)
       - Q: "Did your mom praise you?" A: "Yes" → "My mom praised me." (Mom praised)
       - Q: "Did you say sorry to James?" A: "Yes" → "I told James I was sorry." (I told James I was sorry)
       - Q: "What did the teacher say?" A: "That I sing well" → "The teacher said I sing well." (The teacher said I sing well)
       - Q: "Did you do it during recess? Or during lunch break?" A: "1" → "I did it during recess." (Recess)
   
   • **CRITICAL: Analyze question-answer context to determine the correct panel placement:**
   • **CRITICAL: When question asks about someone's words, preserve the speaker in the answer:**
     - Q: "What did the teacher say?" A: "said I sing well."
     - Result: "The teacher told me that I sing well." (NOT "I thought I sang well")
   • **CRITICAL: D panel (emotion) should ONLY contain pure emotion words:**
   • **CRITICAL: When question asks about someone's action, preserve the actor:**
     - Q: "What did your mom do?" A: "She cooked."
     - Result: "My mom cooked." (NOT "I cooked")
   • **CRITICAL: When question asks about someone's action, the answer should maintain the same subject:**
     - Q: "Did Minsu go to the supermarket?" A: "Yes."
     - Result: "Minsu went to the supermarket." (NOT "I went to the supermarket")
   • **CRITICAL: When question asks about the user's action with "Yes", extract the complete action including subject:**
     - Q: "Did you say sorry to James?" A: "Yes."
     - Result: "I told James I was sorry." (Extract complete action from question)
     - Q: "Did the teacher praise you?" A: "Yes."
     - Result: "The teacher praised me." (Preserve original subject from question)
   • Merge with existing content in the target panel, ONLY using information from user content (new_QA)
     - If user mentioned place/time → add to panel1 (A)
     - If user mentioned behavior → add to panel2 (B)
     - If user mentioned consequence → add to panel3 (C)
     - If user mentioned emotion words → add to panel4 (D)
   • If user didn't provide specific information → leave panel as null

2. **CRITICAL: When merging with existing content, consider context and flow:**
   • **CONTEXT ANALYSIS: Understand the relationship between existing and new information:**
     - Time relationship: when, while, during, after
     - Cause-effect relationship: because, since, so, and then
     - Method relationship: with, by, using, as
     - Location relationship: at, in 
     - Person relationship: with, to, for
     - **Addition**: and, while, also, too, as well
   
   • **SMART MERGING STRATEGY: Replace incorrect info and maintain time order:**
     - **REPLACE INCORRECT INFO**: If existing content is wrong, replace it completely
       - Q: "Where did you play?" A: "At the park" → "I played at the playground" → "I played at the park" (replace playground to park)
       - Q: "What did you draw with?" A: "Crayons" → "I drew with a pencil" → "I drew with crayons" (replace pencil to crayons)
       - Q: "When did you do it?" A: "In the afternoon" → "I played in the morning" → "I played in the afternoon" (replace morning to afternoon)
     - **MAINTAIN TIME ORDER**: Arrange information in chronological order within panel
       - Q: "What did you do before that?" A: "I did homework first" → "I did homework and then played"
       - Q: "What did you do next?" A: "I had lunch" → "I played and then had lunch"
       - Q: "Why did she cry?" A: "Because I bumped into her" → "I bumped into her and Sally cried"
     - **NATURAL FLOW COMBINATION**: Combine related information naturally
       - Q: "Who were you with?" A: "Mom" → "I drew with Mom"
       - Q: "How did you do it?" A: "With crayons" → "I drew with crayons"
       - Q: "When did you do it?" A: "During recess" → "I played during recess"
   • **CONTEXT-AWARE EXAMPLES:**
     - **Replace incorrect location**: Q: "Where did you play?" A: "At the park" → "I played at the playground" → "I played at the park"
     - **Replace incorrect method**: Q: "What did you draw with?" A: "Crayons" → "I drew with a pencil" → "I drew with crayons"
     - **Maintain time order**: Q: "What did you do before that?" A: "Homework first" → "I did homework and then played"
     - **Natural cause-effect**: Q: "Why did she cry?" A: "I bumped into her" → "I bumped into her and Sally cried"
     - **Combine related info**: Q: "Who were you with?" A: "Mom" → "I drew with Mom"

**STEP 3: SENTENCE COMPLETION AND CLEANUP (THIRD PRIORITY)**
1. **Complete incomplete sentences and ensure proper format:**
   • **CRITICAL: Convert all panels to complete first-person past-tense English sentences**
   • If a panel contains incomplete phrases like "at...", "in...", "with..." → complete the sentence
   • Examples of completion:
     - "at school" → "I was at school."
     - "during class" → "It was during class."
2. **CRITICAL: Each panel must be a complete, natural English sentence**
3. **CRITICAL: Use past tense ("I ~ed", "I was ~", etc.)**

**CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:**
1. **When add new information, ONLY use content from "panels_original" + "new_QA"**. NEVER copy example text like "e.g. 'I was happy'" into panels
2. **NEVER invent new events, lines, or feelings**
3. **KEEP ALL content from "panels_original" - NEVER delete or remove existing content**
4. **Each panel must contain only content appropriate for its category**
5. **CRITICAL: When merging content, PRESERVE ALL existing information**
6. **CRITICAL: Only add new information, NEVER replace or remove existing content unless explicitly instructed by order array**
7. **CRITICAL: If order array says to move content, ONLY move the exact text mentioned, keep everything else**
5. **Keep each panel to one complete English past-tense sentence, first-person diary style**
6. **CRITICAL: When separating content, maintain natural English flow**
7. **CRITICAL: Complete all incomplete sentences to proper English past-tense format**
8. **CRITICAL: Preserve the actor/subject from the question in the answer:**
    - If question asks "What did the teacher say?" → Answer should be "The teacher said [content]"
    - If question asks "What did your mom do?" → Answer should be "My mom [content]"
    - If question asks "What did your friend do?" → Answer should be "My friend [content]"
    - **NEVER change the actor from the question to "I" unless the question specifically asks about the user's own action**
9. **CRITICAL: When question asks about someone's words/reaction, put it in panel3 (C) as consequence**
10. **CRITICAL: When question asks about someone's action, put it in panel2 (B) as behavior**
11. **CRITICAL: D panel (emotion) content should ONLY contain pure emotion words**
12. **CRITICAL: When combining sentences, use proper English grammar and natural flow**
13. **CRITICAL: For simple agreement answers ("Yes", "Yeah"), extract the COMPLETE action from the question including the subject:**
    - Q: "Did you play at the playground?" A: "Yes" → Extract "I played at the playground" from question
    - Q: "Did your friend cry?" A: "Yes" → Extract "My friend cried" from question
14. **CRITICAL: For choice questions, interpret the selected choice:**
    - Q: "During recess? Or lunch break?" A: "1" → "I did it during recess."
    - Q: "In the morning? Or afternoon?" A: "2" → "I did it in the afternoon."


Output exactly this JSON (nothing else, no line breaks inside values):

{{
  "panel1": "...",
  "panel2": "...",
  "panel3": "...",
  "panel4": "..."
}}

Write all panel content in natural English. Output panels in English only.  

Here are the examples:
### Example 1
<panels_original>
"panel1": "Minsu and I did a mackerel dissection show at school.",
"panel2": null,
"panel3": "I cut off the head, opened the belly, and put the organs in a bag.",
"panel4": null
<new_QA>
question: "Wow, a mackerel dissection! 🐟 When did you do it at school? 1) Recess? 2) Lunch break?"
answer: "1"
<order>
[
  "B content in C: 'I cut off the head, opened the belly, and put the organs in a bag' should move to B, keep '' in C"
]
<expected_output>
{{
  "panel1": "Minsu and I did a mackerel dissection show at school during recess.",
  "panel2": "I cut off the head, opened the belly, and put the organs in a bag.",
  "panel3": null,
  "panel4": null
}}

### Example 2 - Simple Agreement Answer with Subject Extraction
<panels_original>
"panel1": "I told my mom I wanted to go to the amusement park.",
"panel2": "Mom said, 'Okay, let's go.'",
"panel3": "We are going to ride the roller coaster next Saturday.",
"panel4": "I was nervous."
<new_QA>
question: "A roller coaster, I'd be nervous too! 😅 So did you talk to Mom about it at home?"
answer: "Yes"
<order>
[
  "B content in A: 'I told my mom I wanted to go to the amusement park' should move to B, keep '' in A",
  "C content in B: 'Mom said okay let's go' should move to C, keep '' in B"
]
<expected_output>
{{
  "panel1": "I was at home with my mom.",
  "panel2": "I told my mom I wanted to go to the amusement park.",
  "panel3": "Mom said 'Okay, let's go' so we are going to ride the roller coaster next Saturday.",
  "panel4": "I was nervous."
}}

### Example 2b - Subject Extraction from Question
<panels_original>
"panel1": "I had a fight with my friend at school.",
"panel2": "I got angry and shouted.",
"panel3": null,
"panel4": "I felt sorry."
<new_QA>
question: "So did you say sorry to James?"
answer: "Yes"
<order>
[]
<expected_output>
{{
  "panel1": "I had a fight with my friend at school.",
  "panel2": "I got angry and shouted.",
  "panel3": "I told James I was sorry.",
  "panel4": "I felt sorry."
}}

### Example 3 - Replace and Maintain Time Order
<panels_original>
"panel1": "I walked down the hallway at school.",
"panel2": "Sally suddenly blocked me and started crying.",
"panel3": null,
"panel4": "I was nervous and sweaty."
<new_QA>
question: "Oh no.. that must have been surprising 😮 What happened before she started crying?"
answer: "I just walked past her."
<order>
[]
<expected_output>
{{
  "panel1": "I walked down the hallway at school.",
  "panel2": "I just walked past and then Sally suddenly blocked me and started crying.",
  "panel3": null,
  "panel4": "I felt nervous and sweaty."
}}

### Example 4 - Content Separation
<panels_original>
"panel1": "I played hide-and-seek with my friends at the playground.",
"panel2": "",
"panel3": "I hid but Minsu found me and looked at me with a surprised face.",
"panel4": "I was excited."
<new_QA>
question: "Where did you hide?"
answer: "Behind the tree"
<order>
[
  "B content in C: 'I hid' should move to B, keep 'but Minsu found me' in C"
]
<expected_output>
{{
  "panel1": "I played hide-and-seek with my friends at the playground.",
  "panel2": "I hid behind the tree.",
  "panel3": "But Minsu found me. And he looked at me with a surprised face.",
  "panel4": "I was excited."
}}

### Example 5 - D Content in C Separation
<panels_original>
"panel1": "I made pizza with my mom.",
"panel2": "I kneaded the dough and added the toppings.",
"panel3": "Mom praised me and I was happy and excited",
"panel4": null
<new_QA>
question: "How did you feel when Mom praised you?"
answer: "I was happy and excited"
<order>
[
  "D content in C: 'I was happy and excited' should move to D, keep 'Mom praised me' in C"
]
<expected_output>
{{
  "panel1": "I made pizza with Mom.",
  "panel2": "I kneaded the dough and put toppings on it.",
  "panel3": "Mom praised me for making it well",
  "panel4": "I felt happy and excited"
}}"""

        # Use comic_context if present, else revision_1
        panels_original = journal.comic_context if journal.comic_context else journal.revision_1 or {}

        # Extract order array only
        order_instructions = self.story_analysis.get("order", [])
        
        user_prompt = f"""<panels_original>
"panel1": "{panels_original.get('panel1', 'null')}",
"panel2": "{panels_original.get('panel2', 'null')}",
"panel3": "{panels_original.get('panel3', 'null')}",
"panel4": "{panels_original.get('panel4', 'null')}"
<new_QA>
question: "{question}"
answer: "{answer}"
<order>
{json.dumps(order_instructions, indent=2, ensure_ascii=False)}

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
                result = self.reconstruction_parser.parse(response.content)
                
                # Convert to dict format for compatibility
                reconstructed_panels = {
                    "panel1": result.panel1,
                    "panel2": result.panel2,
                    "panel3": result.panel3,
                    "panel4": result.panel4
                }
                
                # Store latest panel state in memory
                self.current_panels = reconstructed_panels

                # Save reconstructed data to Journal
                await update_journal_data(
                    self.db, self.journal_entry_id,
                    comic_context=reconstructed_panels
                )
                
                # Clear order array after processing (so processed orders don't reappear)
                if order_instructions:
                    self.story_analysis["order"] = []
                    # Re-analyze story_analysis with order removed
                    self.story_analysis = await self._analyze_story_flow()
                
                print(f"Panel Reconstruction Result: {json.dumps(reconstructed_panels, ensure_ascii=False, indent=2)}")
                return
                
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed for panel reconstruction")
                    return
                await asyncio.sleep(1)  # Brief delay before retry
    
    async def _get_next_question(self) -> tuple[str, MessageIntent, str]:
        """Generate next question; also return focus panel."""
        try:
            if not self.story_analysis:
                return "I turned what you told me into a four-panel comic! But I couldn't draw everything with the information I had. Could you help me fill in the missing parts? When you're ready, press the 'Next' button!", MessageIntent.PromptNext, None
            
            # Check content and order issues
            has_content_issues, has_order_issues = self._check_issues(self.story_analysis)
            has_real_issues = has_content_issues or has_order_issues
            
            if not has_real_issues:
                # Move to next stage when comic_context is complete
                update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision2)
                return "Perfect! Is there anything you'd like to change or add? 🤔", MessageIntent.PromptIssueExist, None
            
            # Only order issues, no content issues
            if has_order_issues and not has_content_issues:
                print(f"[DEBUG] comic_context_eng: Only order issues detected, continuing with reconstruction")

                # Auto reconstruction up to 2 attempts
                for reconstruction_attempt in range(2):
                    print(f"[DEBUG] comic_context_eng: Auto reconstruction attempt {reconstruction_attempt + 1}")
                    await self._reconstruct_panel("", f"auto reconstruction {reconstruction_attempt + 1}", False)
                    self.story_analysis = await self._analyze_story_flow()
                    print(f"[DEBUG] comic_context_eng: story_analysis after auto reconstruction {reconstruction_attempt + 1}: {self.story_analysis}")

                    content_has_issues_after, has_order_issues_after = self._check_issues(self.story_analysis)

                    # Exit loop if content issues appeared or order issues resolved
                    if not has_order_issues_after or content_has_issues_after:
                        break
                
                # If only order issues remain after 2 attempts, force completion
                if has_order_issues_after and not content_has_issues_after:
                    print(f"[DEBUG] comic_context: Still only order issues after 2 attempts, forcing completion")
                    child_name = await self._get_child_name()
                    dyad = await self._get_dyad()
                    response_message = t('Journaling.Messages.ComicContextComplete', dyad.locale).format(
                        child_name=child_name
                    )
                    response_intent = MessageIntent.StartComicGeneration
                    return response_message, response_intent, None
                # If content issues appeared or order resolved, continue to next question (below)

            # Decide focus panel - find panel with actually missing information
            panels = ["A", "B", "C", "D"]
            panel_mapping = {"A": "panel1", "B": "panel2", "C": "panel3", "D": "panel4"}
            focused_panel = None
            
            content_issues = self.story_analysis.get("content", {})
            
            # Get journal from DB
            journal = await get_journal(self.db, self.journal_entry_id)
            panels_content = journal.comic_context if journal and journal.comic_context else journal.revision_1 if journal and journal.revision_1 else {}

            # Compare each panel content with issues to find truly missing information
            for panel in panels:
                panel_issues = content_issues.get(panel, [])
                panel_content = panels_content.get(panel_mapping[panel], "")
                
                # Check if information is actually missing
                if panel_issues and any(issue for issue in panel_issues if issue and issue != ''):
                    # Check if info already exists in another panel
                    info_already_exists = False
                    for other_panel in panels:
                        if other_panel != panel:
                            other_content = panels_content.get(panel_mapping[other_panel], "")
                            # Simple keyword match for duplicate check
                            if panel_content and other_content and any(keyword in other_content for keyword in panel_content.split()):
                                info_already_exists = True
                                break
                    
                    if not info_already_exists:
                        focused_panel = panel_mapping[panel]
                        break
            
            # Get all ComicContext stage messages as conversation_history
            messages = await get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.ComicContext)
            conversation_history = ""
            if messages:
                conversation_history = "\n".join([
                    f"{'Q' if msg.role == MessageRole.Assistant else 'A'}: {msg.content}"
                    for msg in messages
                ])

            # Consecutive "don't know" answers
            dont_know_keywords = ["don't know", "don't remember", "not sure", "no idea", "forgot", "can't remember", "dunno", "i don't know"]
            recent_answers = [msg for msg in messages if msg.role == MessageRole.User][-3:][::-1]  # Last 3 answers
            consecutive_dont_know_count = sum(
                1 for msg in recent_answers
                if any(keyword in msg.content.lower() for keyword in dont_know_keywords)
            )
            
            client = openai.OpenAI()
            
            character_bg = self.get_character_background()
            system_prompt = f"""{character_bg}

**CRITICAL: You MUST follow the character background above in EVERY response!**

Your task: generate ONE follow-up question that fills the FIRST missing information gap listed in the analysis. The question MUST start with a friendly, enthusiastic reaction to the user's previous answer before asking the follow-up question.

ABCD STRUCTURE:
- A (panel1): Antecedent - where, who, situation (time optional)
- B (panel2): Behavior - observable action, how/how long/with what
- C (panel3): Consequence - immediate result or existing character's response (avoid new characters)
- D (panel4): Emotion - writer's own feeling only (emotion word)

=== Question-Generation Rules ===
1. **ALWAYS start with a friendly, sympathetic reaction to the user's previous answer:**
   - Show genuine interest and excitement about what they shared but no interjection.
   - Use appropriate emojis to match the mood
   - Reference specific details from their answer
2. **FIRST: Check situation_type from analysis_result:**
   - If "problematic": Focus on situational overview questions (context, timing, environment)
   - If "normal": Focus on "HOW" questions (methods, details)
3. **CRITICAL: Focus on the FIRST missing information in order: A → B → C → D**
   - **MANDATORY: Check story_analysis.content array and focus ONLY on the FIRST panel with missing information**
   - **MANDATORY: If A has missing info (non-empty array), ask about A ONLY. If A is complete (empty array) but B has missing info, ask about B ONLY.**
   - **CRITICAL: Before asking any question, verify that the information is NOT already present in ANY panel**
   - **CRITICAL: Cross-reference all panels to avoid asking about information that already exists**
      - **CRITICAL: Use the specific examples from story_analysis to create targeted questions**
   - **CRITICAL: NEVER ask generic questions like "What did you do next?" or "What happened?"**
   - **CRITICAL: ALWAYS extract specific details from the analysis example and create precise questions**
   - **CRITICAL: Extract the specific action, result, or emotion from the example and create a choice-based question**
   - **CRITICAL: Make questions specific and actionable based on the analysis examples**
4. Ask exactly ONE question that can elicit the missing detail.
5. **CRITICAL: When asking about C (Consequence), focus on NEXT actions, not HOW:**
   - If B already describes the result, ask "What did you do next?" or "What happened after that?"
   - Examples: "Did you keep riding the bike? Or did you stop and thank him?"
   - Do NOT ask "How did you do it?" when the result is already clear
   - **CRITICAL: NEVER ask generic questions like "What did you do next?" or "What happened?"**
   - **CRITICAL: ALWAYS extract specific details from the analysis example and create precise questions**
   - **CRITICAL: Extract the specific action, result, or emotion from the example and create a choice-based question**
6. **CRITICAL: Use proper character references - NEVER use "we" to refer to characters:**
   - **NEVER say "we" when referring to characters in the story**
   - **ALWAYS use specific character names**
   - **Examples:**
     - "Did you play with Ethan?" (NOT "we played together")
     - "Where did you do it with Mom?" (NOT "where did we do it")
     - "Did you talk to the teacher?" (NOT "did we talk to the teacher")
7. **CHOICE RULE: Only provide 2-3 choices when the question naturally limits to exactly 2-3 options:**
   - Examples that SHOULD have choices: "Was it inside school or outside?" (2 choices), "Morning or afternoon?" (2 choices)
   - Examples that should NOT have choices: "Where were you?" (many places), "What did you do?" (many activities), "Who was there?" (many people)
   - Use open-ended questions when there are more than 3 natural options
6. Avoid figurative language; keep sentences ≤ 15 syllables.
7. If the child likes topics in "affinity", you may embed them lightly to grab attention.
8. Avoid vague words like "that kind of thing", "like that", "that time".
9. Do NOT repeat questions already asked.
10. Consider the entire conversation history and current panels when generating questions.
11. **CRITICAL: Cross-panel information check**
    - Before asking any question, check ALL panels (A, B, C, D) for the information
    - DO NOT ask about information that is:
      - Already stated in ANY panel (even if it's in a different panel than expected)
      - Already confirmed in previous Q&A
      - Can be inferred from existing information
    - If information exists in any panel, skip that question and move to the next missing information
12. When asking about emotions (panel 4), ask for explicit emotion words:
    - "How did you feel?" (just ask for emotion; choices can be from frontend)
    - **CRITICAL: Only ask emotion questions when panel 4 is missing or null**
    - **CRITICAL: Keep emotion questions simple - just ask "How did you feel?" without providing options**
13. **PROBLEMATIC situations - CRITICAL RULES:**
    - NEVER ask direct "why" questions initially
    - ALWAYS start with situational overview questions
    - Ask about context: "What were you doing then?"
    - Ask about environment: "Who was around?", "What was the situation?"
    - Only after gathering context, then ask about causes
14. **NORMAL situations:**
    - Use "how", "what with", "when" (how-focused)
    - Example: "How did you play?", "What did you draw with?"
15. **CRITICAL: Check ALL panels before asking questions**
    - Before generating any question, check if the information already exists in ANY panel
    - Do NOT ask about information that is already present in any panel
    - Cross-reference all panels to avoid duplicate questions

=== CRITICAL: Imagination Rule ===
16. **ONLY if EXACTLY 3+ consecutive "don't know" answers for the current category:**
    - **MUST** change approach to encourage imagination
    - Start with "Let's imagine!" or "Maybe..." with emojis
    - Make it fun and creative rather than factual
    - Use phrases like "maybe", "imagine if", "perhaps"
    - Focus on what would be most likely or interesting
    - **ALWAYS** provide 2-3 imaginative choices
    - Example: "Let's imagine! 😊 What do you think might have happened? 1) ... 2) ... 3) ..."

17. **If LESS than 3 consecutive "don't know" answers:**
    - Continue with normal situational overview questions
    - Do NOT use imagination prompts
    - Focus on gathering more context and details

=== Output Format (JSON only) ===
{{
  "question": "question in English",
  "focused_panel": "panel1" or "panel2" or "panel3" or "panel4" or null
}}

- Write the question in natural English. Generate questions in English only.  
Here are the examples:
### Example 1
Input:
"panel1": "Minsu and I did a mackerel dissection show at school.",
"panel2": null,
"panel3": "I cut off the head, opened the belly, and put the organs in a bag.",
"panel4": null

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": ["Background missing — e.g. 'During recess'"],
    "B": ["B content in C: 'I cut off the head...' should move to B"],
    "C": [
      "Non-C content in C (behavior described)",
      "Result missing — e.g. 'Minsu laughed and said Wow'"
    ],
    "D": ["Emotion missing — e.g. 'I was happy'"]
  }}
}}

conversation_summary:

Output:
{{
"question": "A mackerel dissection, that's so cool! 🐟 When did you do it at school? Recess? Lunch break? Or some other time?",
"focused_panel": "panel1"
}}

### Example 1b - Emotion Question
Input:
"panel1": "Minsu and I did a mackerel dissection show at school during recess.",
"panel2": "I cut off the head, opened the belly, and put the organs in a bag.",
"panel3": "Minsu laughed and said 'Wow!'",
"panel4": null

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": [""],
    "B": [""],
    "C": [""],
    "D": ["Emotion missing — e.g. 'I was happy'"]
  }}
}}

conversation_summary:
Q: "A mackerel dissection, that's so cool! 🐟 When did you do it at school? Recess? Lunch break?"
A: "Recess"

Output:
{{
"question": "So after the dissection and Minsu said Wow! 😊 How did you feel then?",
"focused_panel": "panel4"
}}

### Example 1c - Specific Consequence Question
Input:
"panel1": "I went to the blueberry farm with my friend and teachers.",
"panel2": "I made pizza at the blueberry farm.",
"panel3": null,
"panel4": null

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": [""],
    "B": [""],
    "C": ["Result missing — e.g. 'We all ate the pizza and it was yummy'"],
    "D": ["Emotion missing — e.g. 'I had fun'"]
  }}
}}

Output:
{{
"question": "After making the pizza, did you all eat it together? Or did you do something else?",
"focused_panel": "panel3"
}}

### Example 2
Input:
"panel1": "I told my mom I wanted to go to the amusement park.",
"panel2": "Mom said, 'Okay, let's go.'",
"panel3": "We are going to ride the roller coaster next Saturday.",
"panel4": "I was nervous."

analysis_result:
{{
  "situation_type": "normal",
  "content": {{
    "A": [
      "Location missing — e.g. 'At home'",
      "Non-A content in A (telling Mom is a behavior, which is B)"
    ],
    "B": [
      "Non-B content in B (Mom's reaction belongs to C)",
      "B missing — actual behavior is in panel 1"
    ],
    "C": [""],
    "D": [""]
  }},
  "order": ["Behavior in panel 1 should move to panel 2",
    "Reaction in panel 2 should move to panel 3"]
}}

conversation_summary:
Q: "The amusement park sounds so fun! What did Mom say when you asked?"
A: "She said let's go so we're going to ride the roller coaster next Saturday."
Q: "You must be excited about the roller coaster! How do you feel?"
A: "Really nervous"

Output:
{{
"question": "I'd be nervous too! 😅 A roller coaster, that's awesome! So where did you talk to Mom about it?",
"focused_panel": "panel1"
}}

### Example 3
Input:
"panel1": "I walked down the hallway at school.",
"panel2": "Sohyun suddenly blocked me and started crying.",
"panel3": null,
"panel4": "I was nervous and sweaty."

analysis_result:
{{
"situation_type": "problematic",
  "content": {{
"A": [""],
"B": [
    "Reason for crying missing — e.g. 'I accidentally bumped into her'"
  ],
  "C": [
    "C missing — e.g. 'Sohyun kept crying and didn't move'"
  ],
  "D": [""]
}},
"order": [""]
}}

conversation_summary:
Q: "That must have been surprising 😮 Why did Sohyun suddenly start crying? Tell me if you remember."
A: "I don't know"
Q: "Did Sohyun say anything while crying? 🤨"
A: "I don't know"
Q: "Was there anyone else around Sohyun? 👫"
A: "I don't know"

Output:
{{
"question": "Oh.. you really don't remember 😅 Let's imagine! Why do you think Sohyun cried? 1) Did another kid bother her? 2) Did she get in trouble with the teacher? 3) Did she think of something sad?",
"focused_panel": "panel2"
}}"""
            
            
            # Get current panel contents
            journal = await get_journal(self.db, self.journal_entry_id)
            # Use comic_context if present, else revision_1
            panels_content = journal.comic_context if journal and journal.comic_context else journal.revision_1 if journal and journal.revision_1 else {}
            
            user_prompt = f"""Current comic panels:
"panel1": "{panels_content.get('panel1', 'null')}",
"panel2": "{panels_content.get('panel2', 'null')}",
"panel3": "{panels_content.get('panel3', 'null')}",
"panel4": "{panels_content.get('panel4', 'null')}"

analysis_result:
{{
  "situation_type": "{self.story_analysis.get('situation_type', 'normal')}",
  "content": {json.dumps(self.story_analysis.get("content", {}), indent=2, ensure_ascii=False)}
}}

conversation_history:
{conversation_history}

consecutive_dont_know_count: {consecutive_dont_know_count}

Please generate a question that addresses the FIRST missing information gap."""

            try:
                # Retry logic for robust parsing
                for attempt in range(3):
                    try:
                        messages = [
                            SystemMessage(content=system_prompt),
                            HumanMessage(content=user_prompt)
                        ]
                        response = await self.llm.ainvoke(messages)
                        result = self.next_question_parser.parse(response.content)
                        question = result.question
                        focused_panel_from_ai = result.focused_panel or focused_panel
                        break
                    except Exception as e:
                        print(f"Attempt {attempt + 1} failed: {e}")
                        if attempt == 2:  # Last attempt
                            print("All attempts failed, returning default question")
                            question = "Tell me about the next!"
                            focused_panel_from_ai = focused_panel
                        else:
                            await asyncio.sleep(1)  # Wait before retry
                
                # Emotion question check
                if "how did you feel" in question.lower() or "how did it feel" in question.lower() or "how did that feel" in question.lower():
                    return question, MessageIntent.PromptEmotion, focused_panel_from_ai
                else:
                    return question, None, focused_panel_from_ai
                
            except Exception as e:
                print(f"[DEBUG] comic_context: Error generating question: {e}")
                return "Tell me about the next!", None, focused_panel
            
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in _get_next_question: {e}")
            return "Tell me about the next!", None, None
    
    async def _generate_first_question(self) -> tuple[str, MessageIntent, str]:
        """Generate first question."""
        try:
            return await self._get_next_question()
        except Exception as e:
            print(f"[DEBUG] comic_context: Error in _generate_first_question: {e}")
            return "Tell me about the next!", None, None
    
    async def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> Any:
        """Get or create interaction turn for current stage."""
        from backend.database.crud.chatbot import get_latest_interaction_turn
        
        latest_turn = await get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            from backend.database.crud.chatbot import create_interaction_turn
            return await create_interaction_turn(self.db, self.journal_entry_id, stage)
    
    def is_complete(self) -> bool:
        """Check if analysis is complete."""
        if not self.story_analysis:
            print(f"[DEBUG] comic_context: is_complete - no story_analysis")
            return False
        
        # Check content and order issues
        has_content_issues, has_order_issues = self._check_issues(self.story_analysis)
        has_real_issues = has_content_issues or has_order_issues
        is_complete = not has_real_issues
        
        return is_complete
    
    async def _generate_final_comic_panels(self) -> dict | None:
        """Generate final comic panels when comic_context is complete and save to Comic table."""
        try:
            # Get comic_context data
            journal = await get_journal(self.db, self.journal_entry_id)
            if not journal or not journal.comic_context:
                return
            
            # Extract panel content (null -> empty string)
            panel_contents = {
                "panel1": journal.comic_context.get("panel1", "") if journal.comic_context.get("panel1") != "null" else "",
                "panel2": journal.comic_context.get("panel2", "") if journal.comic_context.get("panel2") != "null" else "",
                "panel3": journal.comic_context.get("panel3", "") if journal.comic_context.get("panel3") != "null" else "",
                "panel4": journal.comic_context.get("panel4", "") if journal.comic_context.get("panel4") != "null" else ""
            }
            
            # ComicGridGeneratorEng (EN)
            try:
                from backend.core.ai import ComicGridGeneratorEng

                async def progress_callback(progress: int, message: str):
                    """Update status by comic generation progress"""
                    status = ComicStatus.Generating0
                    if progress <= 20:
                        status = ComicStatus.Generating1
                    elif progress <= 60:
                        status = ComicStatus.Generating2
                    elif progress <= 75:
                        status = ComicStatus.Generating3
                    elif progress <= 90:
                        status = ComicStatus.Generating4

                    await update_comic_status(self.db, self.journal_entry_id, status, None)
                    print(f"[DEBUG] Progress: {progress}% - {message}")

                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Generating0, None)

                generator = ComicGridGeneratorEng()
                comic_data = await generator.generate_comic_grids(panel_contents, progress_callback)

                # Save to database
                await update_comic_data(self.db, self.journal_entry_id, comic_data)

                # revision_2 transition (English flow)
                revision2_stage = await Revision2StageEng.create(self.db, self.journal_entry_id)
                revision2_response, intent = await revision2_stage.start_revision()
                
                response = {
                    "response": revision2_response,
                    "intent": intent,
                    "stage": "revision_2"
                }
                
                # Set completed status
                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Completed, comic_data, response)
                
                
                print(f"[DEBUG] comic_context: Status updated to completed for {self.journal_entry_id}")
                
                return comic_data
                
            except Exception as e:
                print(f"[DEBUG] comic_context: Error in comic generation: {e}")
                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Error, None)
                import traceback
                traceback.print_exc()
            
        except Exception as e:
            print(f"[DEBUG] comic_context: Error generating final comic panels: {e}")
            import traceback
            traceback.print_exc() 

 