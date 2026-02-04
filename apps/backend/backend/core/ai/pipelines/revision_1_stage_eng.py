import openai
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI
from langchain.output_parsers import PydanticOutputParser
from langchain.schema import HumanMessage, SystemMessage
from backend.utils.environment import get_env_variable, EnvironmentVariables
from backend.database.crud.chatbot import (
    get_journal_entry, update_journal_entry_stage, get_journal,
    update_journal_data, create_interaction_turn, create_message,
    get_messages_by_journal_entry, update_comic_data, update_comic_status
)
from backend.core.ai.pipelines.comic_context_stage_eng import ComicContextStageEng
from backend.database.models import JournalEntryStage, MessageRole, MessageIntent, ComicStatus, Dyad, Message
from sqlalchemy.orm import Session
from backend.utils.i18n import t
import asyncio
from sqlmodel.ext.asyncio.session import AsyncSession


class PanelRevision(BaseModel):
    """Panel revision result"""
    panel1: Optional[str] = Field(description="Panel 1 content")
    panel2: Optional[str] = Field(description="Panel 2 content")
    panel3: Optional[str] = Field(description="Panel 3 content")
    panel4: Optional[str] = Field(description="Panel 4 content")


class Revision1StageEng:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.child_name = None
        self.revision_count = None
        self.max_revisions = 2

        self.llm = ChatOpenAI(
            model="gpt-4.1-mini-2025-04-14",
            temperature=0.1,
            api_key=get_env_variable(EnvironmentVariables.OPENAI_API_KEY)
        )
        self.revision_parser = PydanticOutputParser(pydantic_object=PanelRevision)

    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'Revision1StageEng':
        """Async factory method"""
        instance = cls(db, journal_entry_id)
        instance.child_name = await instance._get_child_name()
        instance.revision_count = await instance._get_revision_count()
        return instance

    async def _get_dyad(self) -> Dyad:
        """Get dyad for journal entry"""
        from backend.database.crud.chatbot import get_journal_entry

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        return journal_entry.dyad if journal_entry and journal_entry.dyad else None

    async def _get_child_name(self) -> str:
        """Get dyad child_name"""
        from backend.database.crud.chatbot import get_journal_entry

        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name
        return "User"  # fallback

    async def _get_revision_count(self) -> int:
        """Get revision_1_count from Journal"""
        from backend.database.crud.chatbot import get_journal

        journal = await get_journal(self.db, self.journal_entry_id)
        if journal:
            return journal.revision_1_count
        return 0

    async def _update_revision_count(self, new_count: int) -> None:
        """Update Journal revision_1_count"""
        from backend.database.crud.chatbot import update_journal_data

        await update_journal_data(
            self.db, self.journal_entry_id,
            revision_1_count=new_count
        )
        self.revision_count = new_count

    async def start_revision(self) -> Message:
        """Start first revision step (English)"""
        await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Revision1)

        interaction_turn = await create_interaction_turn(
            self.db, self.journal_entry_id, JournalEntryStage.Revision1
        )

        initial_question = "I see! Then let's try writing today's journal entry using what you just told me. Is anything incorrect here? 🤔"
        message = await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            initial_question, MessageRole.Assistant, JournalEntryStage.Revision1,
            intent=MessageIntent.PromptIssueExist
        )

        return message

    async def process_message(self, user_message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Message:
        """Process user message - Structured Output"""
        interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.Revision1)

        await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            user_message, MessageRole.User, JournalEntryStage.Revision1,
            audio_filename=audio_filename,
            intent=intent
        )

        bot_response, intent = await self._generate_response(user_message, intent)

        message = await create_message(
            self.db, self.journal_entry_id, interaction_turn.id,
            bot_response, MessageRole.Assistant, JournalEntryStage.Revision1,
            intent=intent
        )

        return message

    async def _generate_response(self, user_message: str, intent: MessageIntent | None = None) -> tuple[str, MessageIntent]:
        """Generate response to user message (English)"""

        if await self._is_correction_confirmation_question():
            if self._is_negative_response(user_message, intent):
                new_count = self.revision_count + 1
                await self._update_revision_count(new_count)
                if self.revision_count > self.max_revisions:
                    return "Stop kidding around! 😤 This is really, really your last chance! If there's something you really want to fix, tell me!", MessageIntent.PromptOpenEndedAnswer
                elif self.revision_count == self.max_revisions:
                    return "Oops;; This is your last chance! If there's anything wrong, tell me! 😅", MessageIntent.PromptOpenEndedAnswer
                else:
                    return "Oops;; What's wrong and how? 😅", MessageIntent.PromptOpenEndedAnswer
            elif self._is_positive_response(user_message, intent):
                journal = await get_journal(self.db, self.journal_entry_id)

                if self.revision_count == 0:
                    await update_journal_data(
                        self.db, self.journal_entry_id,
                        revision_1=journal.comic_intro
                    )

                return t('Journaling.Messages.Revision1Confirmation', (await self._get_dyad()).locale), MessageIntent.StartComicGeneration
            else:
                raise Exception("Revision 1: Correction confirmation questions must be answered through intent")
        else:
            try:
                await self._apply_user_correction(user_message)
                return "I changed it according to what you told me. Is everything correct now? 🤔", MessageIntent.PromptIssueExist
            except Exception as e:
                print(f"[DEBUG] revision_1_eng: Error applying user correction: {e}")
                return "Something went wrong with the edit. Say it again! 😅", MessageIntent.PromptOpenEndedAnswer

    async def _is_correction_confirmation_question(self) -> bool:
        """Check if current question is the correction confirmation question"""
        messages = await get_messages_by_journal_entry(self.db, self.journal_entry_id)
        if messages:
            for i in range(len(messages) - 1, -1, -1):
                if messages[i].role == MessageRole.Assistant:
                    return messages[i].intent == MessageIntent.PromptIssueExist
            return False
        return False

    def _is_negative_response(self, message: str, intent: MessageIntent) -> bool:
        """Check if response is negative"""
        if intent == MessageIntent.AnswerNegative:
            return True
        negative_keywords = [
            "no", "n", "wrong", "not correct", "incorrect", "not right", "something wrong", "still wrong"
        ]
        return any(keyword in message.lower() for keyword in negative_keywords)

    def _is_positive_response(self, message: str, intent: MessageIntent) -> bool:
        """Check if response is positive"""
        if intent == MessageIntent.AnswerPositive:
            return True
        positive_keywords = [
            "yes", "y", "correct", "good", "right", "all correct", "looks good", "that's enough"
        ]
        return any(keyword in message.lower() for keyword in positive_keywords)

    async def _apply_user_correction(self, correction: str) -> None:
        """Apply user correction - Structured Output (English panels)"""
        journal = await get_journal(self.db, self.journal_entry_id)
        if not journal:
            return

        if journal.revision_1:
            current_panels = journal.revision_1
        elif journal.comic_intro:
            current_panels = journal.comic_intro
        else:
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
8. Keep each panel to one English past-tense sentence, first-person diary style ("I ~ed" / "I was ~")
9. **CRITICAL**: Only change what the user specifically requested
10. Preserve the overall story flow and coherence
11. **IMPORTANT**: You must return ALL 4 panels (panel1, panel2, panel3, panel4) in the JSON output
12. **For panels that should remain unchanged, use the current content**
13. **For panels that should be null, use null value**
14. Write in natural English
15. **IMPORTANT**: Make sure the story remains coherent and logical after revision

OUTPUT FORMAT:
Return a JSON object with all 4 panels: {"panel1": "...", "panel2": "...", "panel3": "...", "panel4": "..."}"""

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
                    revision_1=updated_panels
                )

                print(f"Panel Revision Result: {updated_panels}")
                return

            except Exception as e:
                print(f"Attempt {attempt + 1} failed: {e}")
                if attempt == max_retries - 1:
                    print("All retries failed for panel revision")
                    return
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

    async def _generate_comic_panels(self) -> dict | None:
        """Generate comic panels when revision_1 is complete (same as KR - uses journal data)"""
        try:
            journal = await get_journal(self.db, self.journal_entry_id)
            if not journal or not journal.revision_1:
                return

            panel_contents = {
                "panel1": journal.revision_1.get("panel1", "") if journal.revision_1.get("panel1") != "null" else "",
                "panel2": journal.revision_1.get("panel2", "") if journal.revision_1.get("panel2") != "null" else "",
                "panel3": journal.revision_1.get("panel3", "") if journal.revision_1.get("panel3") != "null" else "",
                "panel4": journal.revision_1.get("panel4", "") if journal.revision_1.get("panel4") != "null" else ""
            }

            try:
                from backend.core.ai import ComicGridGeneratorEng

                async def progress_callback(progress: int, message: str):
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

                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Generating0, None)

                generator = ComicGridGeneratorEng()
                comic_data = await generator.generate_comic_grids(panel_contents, progress_callback)

                await update_comic_data(self.db, self.journal_entry_id, comic_data)

                context_stage = await ComicContextStageEng.create(self.db, self.journal_entry_id)
                response_message = await context_stage.start_context_analysis()

                response_message_dict = {
                    "id": response_message.id,
                    "content": response_message.content,
                    "role": response_message.role,
                    "stage": response_message.stage,
                    "intent": response_message.intent,
                    "audio_filename": response_message.audio_filename,
                    "metadata_json": response_message.metadata_json,
                    "created_at": response_message.created_at.isoformat() if response_message.created_at else None,
                    "updated_at": response_message.updated_at.isoformat() if response_message.updated_at else None
                }

                response = {
                    "journal_entry_id": self.journal_entry_id,
                    "message_id": response_message.id,
                    "response": response_message_dict,
                    "intent": response_message.intent,
                    "stage": "comic_context"
                }

                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Completed, comic_data, response)

                return comic_data

            except Exception as e:
                print(f"[DEBUG] revision_1_eng: Error in comic generation: {e}")
                await update_comic_status(self.db, self.journal_entry_id, ComicStatus.Error, None)
                import traceback
                traceback.print_exc()

        except Exception as e:
            print(f"[DEBUG] revision_1_eng: Error generating comic panels: {e}")
            import traceback
            traceback.print_exc()

    def get_initial_question(self) -> tuple[str, MessageIntent]:
        """Return the first revision question (English)."""
        return "Is there anything incorrect here? 🤔", MessageIntent.PromptIssueExist
