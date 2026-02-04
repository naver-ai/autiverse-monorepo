from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import *
from .completion_message_generator_eng import CompletionMessageGeneratorEng
from backend.database.models import MessageIntent
from sqlmodel import Session
import json
import openai
import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession


class PanelRevision2(BaseModel):
    """Panel revision result for revision 2"""
    panel1: Optional[str] = Field(description="Panel 1 content")
    panel2: Optional[str] = Field(description="Panel 2 content")
    panel3: Optional[str] = Field(description="Panel 3 content")
    panel4: Optional[str] = Field(description="Panel 4 content")


class Revision2StageEng:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = None
        self.revision_count = None
        self.max_revisions = 2
        self.completion_message_generator = CompletionMessageGeneratorEng()

        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.1,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.revision_parser = PydanticOutputParser(pydantic_object=PanelRevision2)

    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'Revision2StageEng':
        """Async factory method"""
        instance = cls(db, journal_entry_id)
        instance.child_name = await instance._get_child_name()
        instance.revision_count = await instance._get_revision_count()
        return instance

    async def _get_child_name(self) -> str:
        """Get dyad child_name"""
        from backend.database.crud.chatbot import get_journal_entry

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            child_name = journal_entry.dyad.child_name
            return child_name
        return "User"  # fallback

    async def _get_revision_count(self) -> int:
        """Get revision_2_count from Journal"""
        from backend.database.crud.chatbot import get_journal

        journal = await get_journal(self.db, self.journal_entry_id)
        if journal:
            return journal.revision_2_count
        return 0

    async def _update_revision_count(self, new_count: int) -> None:
        """Update Journal revision_2_count"""
        from backend.database.crud.chatbot import update_journal_data

        await update_journal_data(
            self.db, self.journal_entry_id,
            revision_2_count=new_count
        )
        self.revision_count = new_count

    async def start_revision(self) -> tuple[str, MessageIntent]:
        """Start second revision step"""
        await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision2)

        interaction_turn = await create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Revision2
        )

        from backend.database.crud.chatbot import get_comic
        comic = await get_comic(self.db, self.journal_entry_id)

        if comic:
            second_panels = {}
            for i in range(1, 5):
                panel_data = getattr(comic, f"second_panel{i}", None)
                if panel_data and isinstance(panel_data, dict):
                    second_panels[f"panel{i}"] = panel_data.get("content", "")
                else:
                    second_panels[f"panel{i}"] = ""

            if any(second_panels.values()):
                await update_journal_data(
                    self.db, self.journal_entry_id,
                    revision_2=second_panels
                )
                print(f"[DEBUG] revision_2: Loaded second_panel data: {second_panels}")

        initial_question = "Wow! Look at the journal we made together! Let's check now to see if verything is included properly. Is there anything you'd like to change or add? 🤔"
        await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_question, MessageRole.Assistant, JournalEntryStage.Revision2,
            intent=MessageIntent.PromptRevision2IssueExist
        )

        return initial_question, MessageIntent.PromptRevision2IssueExist

    async def process_message(self, user_message: str, user_intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """Process user message - Structured Output"""
        interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.Revision2)

        await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            user_message, MessageRole.User, JournalEntryStage.Revision2,
            audio_filename=audio_filename,
            intent=user_intent
        )

        bot_response, intent = await self._generate_response(user_message, user_intent)

        message = await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            bot_response, MessageRole.Assistant, JournalEntryStage.Revision2,
            intent=intent
        )

        return message

    async def _generate_response(self, user_message: str, user_intent: MessageIntent) -> tuple[str, MessageIntent]:
        """Generate response - Structured Output"""

        if await self._is_correction_confirmation_question():
            if self._is_negative_response(user_message, user_intent):  # has more to fix
                new_count = self.revision_count + 1
                await self._update_revision_count(new_count)
                print(f"[DEBUG] revision_2: revision_count: {self.revision_count}")
                if self.revision_count > self.max_revisions:
                    return "No more fooling around! 😤 This is really, really your last chance! If there's anything you really want to change or add, tell me!", MessageIntent.PromptOpenEndedAnswer
                elif self.revision_count == self.max_revisions:
                    return "Oops;; This is your last chance! If there's anything you want to change or add, tell me everything! 😅", MessageIntent.PromptOpenEndedAnswer
                else:
                    return "Which part do you want to change and how? 🤔", MessageIntent.PromptOpenEndedAnswer
            elif self._is_positive_response(user_message, user_intent):  # no more edits
                comic_data = await self._get_completed_comic_data()
                completion_message = await self.completion_message_generator.generate_completion_message(comic_data, self.child_name)
                return completion_message, MessageIntent.TransitionToTitle
            else:
                print(f"[DEBUG] revision_2: _generate_response: intent={user_intent}, Should not reach here!!")
                raise Exception("Revision 2: Correction confirmation questions must be answered through intent")
        else:
            try:
                await self._apply_user_correction(user_message)
                return "I changed it according to what you told me. Is everything correct now? 🤔", MessageIntent.PromptRevision2IssueExist
            except Exception as e:
                print(f"[DEBUG] revision_2: Error applying user correction: {e}")
                return "Something went wrong while updating. Say it again! 😅", MessageIntent.PromptOpenEndedAnswer

    async def _is_correction_confirmation_question(self) -> bool:
        """Check if current question is the correction confirmation"""
        messages = await get_messages_by_journal_entry(self.db, self.journal_entry_id)
        if messages:
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].role == MessageRole.Assistant:
                    return messages[i].intent in [MessageIntent.PromptIssueExist, MessageIntent.PromptRevision2IssueExist]
            return False
        return False

    def _is_negative_response(self, message: str, user_intent: MessageIntent) -> bool:
        """True if user said they have more to fix (e.g. 'yes there is something')"""
        if user_intent == MessageIntent.AnswerNegative:
            return True
        positive_keywords = ["yes", "yeah", "there is", "something", "one more", "have some", "a few"]
        return any(kw in message.lower() for kw in positive_keywords)

    def _is_positive_response(self, message: str, user_intent: MessageIntent) -> bool:
        """True if user said no more edits (e.g. 'no', 'nothing')"""
        if user_intent == MessageIntent.AnswerPositive:
            return True
        negative_keywords = ["no", "none", "nothing", "nope", "all good", "don't have", "no more", "that's all"]
        return any(kw in message.lower() for kw in negative_keywords)

    async def _apply_user_correction(self, correction: str) -> None:
        """Apply user correction - Structured Output (English panels)"""
        journal = await get_journal(self.db, self.journal_entry_id)
        if not journal or not journal.revision_2:
            return

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
8. Keep each panel to one English past-tense sentence, first-person diary style
9. **CRITICAL**: Only change what the user specifically requested
10. Preserve the overall story flow and coherence
11. **IMPORTANT**: You must return ALL 4 panels (panel1, panel2, panel3, panel4) in the JSON output
12. **For panels that should remain unchanged, use the current content**
13. **For panels that should be null, use null value**
14. Write in natural English
15. **IMPORTANT**: Make sure the story remains coherent and logical after revision

OUTPUT FORMAT:
Return a JSON object with all 4 panels: {"panel1": "...", "panel2": "...", "panel3": "...", "panel4": "..."}"""

        current_panels = journal.revision_2
        user_prompt = f"""Current comic panels:
"panel1": "{current_panels.get('panel1', 'null')}",
"panel2": "{current_panels.get('panel2', 'null')}",
"panel3": "{current_panels.get('panel3', 'null')}",
"panel4": "{current_panels.get('panel4', 'null')}"

User's correction request: {correction}
"""

        max_retries = 3
        for attempt in range(max_retries):
            try:
                messages = [
                    SystemMessage(content=system_prompt),
                    HumanMessage(content=user_prompt)
                ]

                response = await self.llm.ainvoke(messages)
                result = self.revision_parser.parse(response.content)

                updated_panels = current_panels.copy()
                if result.panel1 is not None:
                    updated_panels["panel1"] = result.panel1 if result.panel1 != "null" else None
                if result.panel2 is not None:
                    updated_panels["panel2"] = result.panel2 if result.panel2 != "null" else None
                if result.panel3 is not None:
                    updated_panels["panel3"] = result.panel3 if result.panel3 != "null" else None
                if result.panel4 is not None:
                    updated_panels["panel4"] = result.panel4 if result.panel4 != "null" else None

                await update_journal_data(
                    self.db, self.journal_entry_id,
                    revision_2=updated_panels
                )

                print(f"Panel Revision 2 Result: {updated_panels}")
                return

            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed for panel revision 2")
                    return
                await asyncio.sleep(1)

    async def _get_or_create_interaction_turn(self, stage: JournalEntryStage) -> InteractionTurn:
        """Get or create interaction turn for this stage"""
        from backend.database.crud.chatbot import get_latest_interaction_turn

        latest_turn = await get_latest_interaction_turn(self.db, self.journal_entry_id)
        if latest_turn and latest_turn.stage == stage:
            return latest_turn
        from backend.database.crud.chatbot import create_interaction_turn
        return await create_interaction_turn(self.db, self.journal_entry_id, stage)

    async def _get_completed_comic_data(self) -> Dict[str, Any]:
        """Get completed comic data"""
        from backend.database.crud.chatbot import get_journal

        journal = await get_journal(self.db, self.journal_entry_id)
        if journal:
            return journal.revision_2 if journal.revision_2 else journal.comic_context
        return {}

    def get_initial_question(self) -> tuple[str, MessageIntent]:
        """Return the first revision question."""
        return "Wow! Look at the journal we made together! Let's check now to see if verything is included properly. Is there anything you'd like to change or add? 🤔", MessageIntent.PromptRevision2IssueExist
