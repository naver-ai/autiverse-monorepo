import asyncio
import sys
import locale
from enum import Enum, auto
from typing import Dict, Any, Set, List, Tuple, Optional
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage
from langchain.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import *
from sqlmodel import Session
import json
from dataclasses import dataclass
import random
import openai
from sqlmodel.ext.asyncio.session import AsyncSession

class ConversationMilestone(Enum):
    EVENTS_COLLECTED = "✓ 1. Collected 2-3 simple things that happened there"
    STORY_SUMMARIZED = "✓ 2. Summarized the story in simple steps"

class ConversationState(Enum):
    ASK_EVENTS = auto()
    SUMMARIZE = auto()
    FAREWELL = auto()

class EventAnalysisResult(BaseModel):
    """Event analysis result"""
    events_identified: List[str] = Field(description="List of identified events")
    special_interests_mentioned: List[str] = Field(description="List of special interests mentioned")
    conversation_summary: str = Field(description="Summary of the conversation")
    should_proceed: bool = Field(description="Whether to proceed to next stage")
    comic_panels: Optional[Dict[str, Optional[str]]] = Field(description="Comic panels content")

class ConversationResponse(BaseModel):
    """Conversation response data"""
    response: str = Field(description="Generated conversation response")

@dataclass
class EventAnalysis:
    """
    A class to analyze and track events in the conversation.
    This is the main class used for event analysis throughout the application.
    """
    events_identified: List[str]
    special_interests_mentioned: List[str]
    conversation_summary: str
    should_proceed: bool
    comic_panels: Optional[Dict[str, Optional[str]]] = None

    @classmethod
    def create_empty(cls) -> 'EventAnalysis':
        return cls(
            events_identified=[],
            special_interests_mentioned=[],
            conversation_summary="No conversation yet.",
            should_proceed=False,
            comic_panels=None
        )

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'EventAnalysis':
        return cls(
            events_identified=data.get('events_identified', []),
            special_interests_mentioned=data.get('special_interests_mentioned', []),
            conversation_summary=data.get('conversation_summary', 'No conversation yet.'),
            should_proceed=len(data.get('events_identified', [])) >= 2,
            comic_panels=data.get('comic_panels')
        )



class ComicIntroStageEng:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = None
        self.child_age = None
        self.child_gender = None
        self.agent_name = None
        self.agent_interests = None

        # LangChain setup
        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.2,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.analysis_parser = PydanticOutputParser(pydantic_object=EventAnalysisResult)
        self.response_parser = PydanticOutputParser(pydantic_object=ConversationResponse)

    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'ComicIntroStageEng':
        """Async factory method"""
        instance = cls(db, journal_entry_id)
        instance.child_name = await instance._get_child_name()
        instance.child_age = await instance._get_child_age()
        instance.child_gender = await instance._get_child_gender()
        instance.agent_name = await instance._get_agent_name()
        instance.agent_interests = await instance._get_agent_interests()
        return instance

    async def _get_child_name(self) -> str:
        """Get dyad child_name"""
        from backend.database.crud.chatbot import get_journal_entry, get_dyad_by_id

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name
        return "User"  # fallback

    async def _get_child_age(self) -> int:
        """Get dyad child_age"""
        from backend.database.crud.chatbot import get_journal_entry

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_age
        return 15  # fallback

    async def _get_agent_name(self) -> str:
        """Get agent agent_name"""
        from backend.database.crud.chatbot import get_journal_entry

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad and journal_entry.dyad.agents:
            return journal_entry.dyad.agents[0].agent_name
        return "Dodo"  # fallback

    async def _get_agent_interests(self) -> list[str]:
        """Get agent interest list"""
        from backend.database.crud.chatbot import get_journal_entry

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad and journal_entry.dyad.agents:
            interests = []
            for agent in journal_entry.dyad.agents:
                if agent.interest:
                    interests.append(agent.interest)
            return interests
        return ["Dinosaurs", "Counting things", "Talking to himself"]  # fallback

    async def _get_child_gender(self) -> str:
        """Get dyad child_gender"""
        from backend.database.crud.chatbot import get_journal_entry

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_gender
        return "male"  # fallback

    async def start_conversation(self, location: str = None, people: List[str] = None) -> Message:
        """Start conversation"""
        await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Intro)

        journal = await get_journal(self.db, self.journal_entry_id)
        if journal:
            await update_journal_data(
                self.db, self.journal_entry_id,
                location=location,
                people=people
            )

        interaction_turn = await create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Intro
        )

        initial_message = self._generate_intro_message(location, people)
        message = await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_message, MessageRole.Assistant, JournalEntryStage.Intro
        )

        return message

    async def start_conversation_with_suggestion(self) -> Message:
        """Start conversation (for "I don't know what to write" button)"""
        await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Intro)

        journal = await get_journal(self.db, self.journal_entry_id)
        if journal:
            from backend.database.crud.chatbot import get_dyad_places, get_place_people
            journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
            dyad = journal_entry.dyad
            places = await get_dyad_places(self.db, dyad.id)
            people = await get_place_people(self.db, dyad.id)

            from datetime import datetime
            today = datetime.now()
            weekday = today.weekday()

            weekday_fields = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
            current_weekday_field = weekday_fields[weekday]

            suitable_places = [place for place in places if getattr(place, current_weekday_field) == True]

            if suitable_places:
                location = suitable_places[0].name
            else:
                location = "home"

            people_list = [p.name for p in people[:2]] if people else []

            await update_journal_data(
                self.db, self.journal_entry_id,
                location=location,
                people=people_list
            )

        interaction_turn = await create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Intro
        )

        initial_message = await self._generate_suggestion_message()
        message = await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_message, MessageRole.Assistant, JournalEntryStage.Intro
        )

        return message

    async def process_message(self, user_message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """Process user message"""
        interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.Intro)

        await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            user_message, MessageRole.User, JournalEntryStage.Intro,
            intent=intent,
            audio_filename=audio_filename
        )

        bot_response, response_intent = await self._generate_response(user_message, intent)

        message = await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            bot_response, MessageRole.Assistant, JournalEntryStage.Intro,
            intent=response_intent
        )

        return message

    async def analyze_events(self) -> Dict[str, Any]:
        """Event analysis - Structured Output (English)"""
        messages = await get_messages_by_journal_entry(self.db, self.journal_entry_id)

        conversation = []
        for msg in messages:
            if msg.role == MessageRole.User:
                conversation.append(f"{self.child_name}: {msg.content}")
            elif msg.role == MessageRole.Assistant:
                conversation.append(f"Friend: {msg.content}")

        conversation_text = "\n".join(conversation)

        system_prompt = f"""You are an expert at analyzing conversations to identify concrete events and special interests.

TASK:
1. Find sequences of events from different activities that happened today
2. Note any special interests mentioned ({', '.join(self.agent_interests)})
3. Summarize the conversation
4. Create a natural 4-panel comic flow using ONLY the events that were explicitly mentioned

IMPORTANT RULES FOR COMIC PANELS AND SUMMARIES:
- NEVER mention this conversation itself (user-bot interaction)
- Use ONLY the exact words and events mentioned by {self.child_name}
- Each panel must be a complete diary sentence in first-person past tense in English ("I ~ed" / "I was ~" format)
- Identifying separate actions:
  * Different subjects doing different things are separate actions
    - Bad (Combined): "Dad ate pizza and Mom served me pizza"
    - Good (Separate):
      * "Dad ate the pizza"
      * "Mom served me pizza"
  * Same subject doing different things are separate actions
    - Bad (Combined): "I went to school, studied, and played on the playground"
    - Good (Separate):
      * "I studied at school"
      * "I played on the playground"
  * Only combine details about the exact same action
    - Good (Combined): "I drew a T-Rex picture with Mom"
    - Good (Combined): "I did a squid dissection show with my pencil case"
- Panel content rules:
  * Panels 1-3: ONLY use events from events_identified list in chronological order
  * Panel 4: ONLY use emotions/feelings from events_identified list
  * Each panel MUST correspond to an event in events_identified
  * NEVER include content that is not in events_identified
  * NEVER infer or create events that were not explicitly mentioned by {self.child_name}
  * Events in events_identified MUST be explicitly stated by {self.child_name}, not assumed or inferred
  * Words indicating emotions (must be in events_identified to use in panel 4):
    - happy, excited, fun, good
    - sad, upset, angry
    - scared, nervous, shaky
    - tired, exhausted, worn out
- Story flow guidelines:
  * Each panel should naturally lead into the next one
  * Previous panels should provide context for later panels
  * Events must be arranged in chronological order
  * Panels should only be null when there is truly no content for that part of the story
- When summarizing events:
  * Focus on what actually happened to the user
  * Remove user-bot conversation context
  * Keep it direct and concise
- When user describes something imaginatively:
  * Understand it's often a metaphor or play-acting
  * Look for the actual action being described
  * Combine all related descriptions into one coherent event
  * Bad (Split):
    - "I drew with Mom" + "I drew a dinosaur" (same drawing action)
    - "I drew a dinosaur with Mom" + "I drew a T-Rex" (T-Rex is that dinosaur)
    - "I did a squid dissection show" + "I took apart my pencil case like a squid" (one action)
  * Good (Combined):
    - "I drew a T-Rex picture with Mom"
    - "I did a squid dissection show with my pencil case"
- DO NOT add any details that weren't explicitly stated
- DO NOT make assumptions about who was involved or what happened
- Arrange events in a natural story flow across the panels
- For each null panel, include the reason why it's null in parentheses as part of the value

Generate a structured analysis result. Output events_identified and comic_panels in English only.


Example response for walking at school:
{{
    "events_identified": [
        "I was walking at school.",
        "The teacher scolded me."
    ],
    "special_interests_mentioned": [],
    "conversation_summary": "I was walking at school and got scolded by the teacher.",
    "should_proceed": true,
    "comic_panels": {{
        "panel1": "I was walking at school.",
        "panel2": "null (cannot infer why the teacher scolded from walking)",
        "panel3": "The teacher scolded me.",
        "panel4": "null (no feeling stated)"
    }}
}}

Example response for TV watching:
{{
    "events_identified": [
        "I watched Running Man on TV with Mom and Dad at home.",
        "There was a scene where Yoo Jae-seok did a kick.",
        "That part made me laugh the most."
    ],
    "special_interests_mentioned": [],
    "conversation_summary": "I watched Running Man with my family at home and laughed at Yoo Jae-seok's kick scene",
    "should_proceed": true,
    "comic_panels": {{
        "panel1": "I watched Running Man on TV with Mom and Dad at home.",
        "panel2": "null (no prior context for the kick)",
        "panel3": "There was a scene where Yoo Jae-seok did a kick.",
        "panel4": "That part made me laugh the most."
    }}
}}"""

        user_prompt = f"""CONTEXT:
Location: {await self._get_location()}
People: {', '.join(await self._get_people())}

CONVERSATION:
{conversation_text}"""

        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]

                response = await self.llm.ainvoke(messages)
                result = self.analysis_parser.parse(response.content)

                analysis = {
                    "events_identified": result.events_identified,
                    "special_interests_mentioned": result.special_interests_mentioned,
                    "conversation_summary": result.conversation_summary,
                    "should_proceed": result.should_proceed,
                    "comic_panels": result.comic_panels
                }

                await update_journal_data(
                    self.db, self.journal_entry_id,
                    events=analysis.get("events_identified", []),
                    summary=analysis.get("conversation_summary", ""),
                    comic_intro=analysis.get("comic_panels", {})
                )

                print(f"Event Analysis Result: {json.dumps(analysis, ensure_ascii=False, indent=2)}")
                return analysis

            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed for event analysis")
                    return {
                        "events_identified": [],
                        "special_interests_mentioned": [],
                        "conversation_summary": "Analysis failed",
                        "should_proceed": False,
                        "comic_panels": {}
                    }
                await asyncio.sleep(1)

    async def is_ready_for_next_stage(self) -> bool:
        """Check if ready to proceed to next stage"""
        journal = await get_journal(self.db, self.journal_entry_id)
        if journal and journal.events:
            return len(journal.events) >= 2
        return False

    def _generate_intro_message(self, location: str = None, people: List[str] = None) -> str:
        """Generate initial greeting message (English)"""
        if location and people and len(people) > 0:
            return f"I'm so curious about what happened with {', '.join(people)} at {location} today! Tell me everything! 😊"
        elif location:
            return f"Who were you with in {location} today? Let's write about it in your diary! 😊"
        else:
            return "Awesome! You already have a story in mind. Which part of today should we turn into a diary? 😊"

    async def _generate_suggestion_message(self) -> str:
        """Generate message for 'I don't know what to write' button (English)"""
        location = await self._get_location()

        from datetime import datetime
        today = datetime.now()
        weekday = today.weekday()

        day_mapping = {
            0: 'Monday',
            1: 'Tuesday',
            2: 'Wednesday',
            3: 'Thursday',
            4: 'Friday',
            5: 'Saturday',
            6: 'Sunday'
        }
        english_day = day_mapping.get(weekday, 'today')

        if location and location.lower() == "home":
            return "Then let's write a diary about what happened at home today! What did you do at home?"
        elif location:
            return f"Since it's {english_day}, didn't you go to {location}? Want to write about what happened there?"
        else:
            return "What did you do today? 😊"

    async def _generate_response(self, user_message: str, intent: MessageIntent | None = None) -> str:
        """Generate response to user message (English, informal teen)"""
        system_prompt = f"""[General Speaking Rules]
1. Use informal English like talking to a peer friend. No formal titles.
2. Keep responses short and simple - one or two sentences maximum.
3. Use emojis appropriately.
4. Ask only one question per turn.
5. Never apologize or say sorry.
6. Cover only one topic or question in a message if possible, and move to the next upon the user's reaction.
7. If the user brings up special interests, show interest but gently guide back to the main topic.
8. If the user asks a question that should be asked to adults or unrelated to the conversation topic, say you don't know and steer back to the topic.

[Response Format]
You must respond in the following JSON format:
{{
  "response": "your actual response message here"
}}

[Character Background]
You are a {self.child_age}-year-old middle school student named {self.agent_name}.
You're having a friendly conversation with your autistic best friend, {self.child_name} (also {self.child_gender}).

{self.child_name}'s special interests:
{chr(10).join([f"- {interest}" for interest in self.agent_interests])}

Your goal is to help them create a 4-panel diary comic about their day.

[Event Collection Guidelines]
1. What is an Event?
   - An event is a concrete action that happened today
   - Focus on interaction sequences with people present
   - Each interaction or step in the sequence counts as an event
   Examples:
   - Activity "drawing" with family:
     * "Mom helped with the sketch"
     * "I colored with Dad"
     * "We put the finished drawing on the fridge"
   - Activity "reading" with parents:
     * "Dad picked a book from the shelf"
     * "I sat on the sofa next to Mom"
     * "Mom read the book to me"

2. Conversation Flow:
   A. When starting conversation:
      - Keep initial question open and natural
      - Let {self.child_name} lead with what they want to share

   B. When an activity is mentioned:
      - Focus on interactions with people present
      - Use context to ask about how they did it together
      - Bad: "How was drawing?", "What did Mom and Dad do?"
      - Good: (if drawing is mentioned) "What did you draw with Mom?" or "Did Dad help with the drawing?"

   C. When special interests come up:
      - Stay focused on the activity sequence
      - Keep tracking interactions with family members
      - Don't diverge from the main activity

   D. When collecting sequence:
      - Follow the natural flow of interactions
      - Pay attention to each person's role in the activity
      - Look for clear beginning-middle-end sequence
      - Move to next phase when sequence is complete

3. Conversation Rules:
   - Keep responses natural and conversational
   - Focus on interactions and shared moments
   - Use context from previous responses
   - Let {self.child_name}'s responses guide the conversation
   - Use appropriate emojis naturally

IMPORTANT:
- Focus on interaction sequences with people present
- Track how family members participated in the activity
- Let the sequence emerge through natural conversation
- Each interaction in the sequence counts as an event
- Look for clear progression of events with people involved

IMPORTANT: Always respond in natural, teenage-friendly English."""

        messages = await get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.Intro)
        conversation_context = ""
        if messages:
            conversation_context = "\n\nRecent conversation:\n" + "\n".join([
                f"{self.child_name}: {msg.content}" if msg.role == MessageRole.User else f"Friend: {msg.content}"
                for msg in messages
            ])

        user_prompt = f"""Current objective: Help {self.child_name} identify events that happened today at {await self._get_location()} with {', '.join(await self._get_people())}
Current events collected: {', '.join(await self._get_events()) if await self._get_events() else 'None yet'}

Recent conversation:
{conversation_context}

{self.child_name}: {user_message}"""

        for attempt in range(3):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]
                response = await self.llm.ainvoke(messages)
                result = self.response_parser.parse(response.content)
                return result.response, None
            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == 2:
                    print("All attempts failed, returning default response")
                    return "What did you do today? 😊", None
                else:
                    await asyncio.sleep(1)

    async def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> Any:
        """Get or create interaction turn for current stage"""
        from backend.database.crud.chatbot import get_latest_interaction_turn

        latest_turn = await get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        else:
            from backend.database.crud.chatbot import create_interaction_turn
            return await create_interaction_turn(self.db, self.journal_entry_id, stage)

    async def _get_location(self) -> str:
        """Get stored location"""
        journal = await get_journal(self.db, self.journal_entry_id)
        return journal.location if journal else ""

    async def _get_people(self) -> List[str]:
        """Get stored people"""
        journal = await get_journal(self.db, self.journal_entry_id)
        return journal.people if journal and journal.people else []

    async def _get_events(self) -> List[str]:
        """Get stored events"""
        journal = await get_journal(self.db, self.journal_entry_id)
        return journal.events if journal and journal.events else []
