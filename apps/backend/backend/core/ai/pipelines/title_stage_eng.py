from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.database.crud.chatbot import (
    get_journal, update_journal_data, create_interaction_turn,
    create_message, get_messages_by_journal_entry_and_stage
)
from backend.database.models import JournalEntryStage, MessageRole, Message, MessageIntent
from .title_generator_eng import TitleGeneratorEng
from sqlmodel.ext.asyncio.session import AsyncSession


# English prompt phrases used to detect "custom title input" state
_PROMPT_OPEN_ENDED_TITLE = "Then what title would you like?"
_PROMPT_TYPE_IN_CHAT = "Please type the exact title you want in the chat!"


class TitleStageEng:
    def __init__(self, db: Session, journal_entry_id: str):
        self.db = db
        self.journal_entry_id = journal_entry_id
        self.title_generator = TitleGeneratorEng()
        print(f"[DEBUG] title_stage_eng: TitleStageEng initialized for journal_entry_id={journal_entry_id}")

    @classmethod
    async def create(cls, db: AsyncSession, journal_entry_id: str) -> 'TitleStageEng':
        """Async factory method"""
        instance = cls(db, journal_entry_id)
        return instance

    async def _get_child_name(self) -> str:
        """Get dyad child_name"""
        from backend.database.crud.chatbot import get_journal_entry
        journal_entry = await get_journal_entry(self.db, self.journal_entry_id)
        if journal_entry and journal_entry.dyad:
            return journal_entry.dyad.child_name or "Friend"
        return "Friend"

    async def start_title_selection(self) -> Message:
        """Start title selection (English)."""
        try:
            from backend.database.crud.chatbot import update_journal_entry_stage
            await update_journal_entry_stage(self.db, self.journal_entry_id, JournalEntryStage.Title)

            interaction_turn = await create_interaction_turn(
                self.db, self.journal_entry_id, JournalEntryStage.Title
            )

            journal = await get_journal(self.db, self.journal_entry_id)
            if not journal:
                return await create_message(
                    self.db, self.journal_entry_id, interaction_turn.id,
                    "Could not find comic data.",
                    MessageRole.Assistant, JournalEntryStage.Title
                )

            comic_data = journal.revision_2 if journal.revision_2 else journal.comic_context
            if not comic_data:
                return await create_message(
                    self.db, self.journal_entry_id, interaction_turn.id,
                    "Could not find comic data.",
                    MessageRole.Assistant, JournalEntryStage.Title
                )

            child_name = await self._get_child_name()
            generated_titles = await self.title_generator.generate_title(comic_data, child_name)

            initial_question = f"What should we title today's journal? 1) {generated_titles['title1']}. 2) {generated_titles['title2']}. 3) {generated_titles['title3']}. Which title do you like?"

            new_message = await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                initial_question, MessageRole.Assistant, JournalEntryStage.Title,
                metadata_json={"titles": generated_titles},
                intent=MessageIntent.InitialTitleConfirm
            )

            return new_message

        except Exception as e:
            print(f"[DEBUG] title_stage_eng: Error in start_title_selection: {e}")
            raise

    async def process_message(self, user_message: str, intent: MessageIntent | None = None, audio_filename: str = None) -> Message | None:
        """Process user message (English flow)."""
        try:
            interaction_turn = await self._get_or_create_interaction_turn(JournalEntryStage.Title)

            await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                user_message, MessageRole.User, JournalEntryStage.Title,
                audio_filename=audio_filename,
                intent=intent
            )

            child_name = await self._get_child_name()
            messages = await get_messages_by_journal_entry_and_stage(self.db, self.journal_entry_id, JournalEntryStage.Title)

            last_assistant_message: Message | None = None
            for message in reversed(messages):
                if message.role == MessageRole.Assistant and message.content.strip():
                    last_assistant_message = message
                    break

            if not last_assistant_message:
                return None

            metadata = None

            if last_assistant_message.intent == MessageIntent.InitialTitleConfirm:
                response, response_intent = await self._process_title_selection(user_message, last_assistant_message, child_name)

            elif last_assistant_message.intent == MessageIntent.CustomTitleConfirm:
                custom_title = last_assistant_message.metadata_json.get("title", "")

                reject_count = 0
                for message in messages:
                    if message.role == MessageRole.User and message.content in ["No, something else", "ChatInput.ButtonLabels.NoOther"]:
                        reject_count += 1

                response, response_intent = self.title_generator.process_custom_title_feedback(
                    user_message, custom_title, child_name, reject_count
                )

            elif (_PROMPT_OPEN_ENDED_TITLE in last_assistant_message.content) or (_PROMPT_TYPE_IN_CHAT in last_assistant_message.content):
                await self._save_title(user_message.strip())
                response, response_intent, metadata = self.title_generator.confirm_custom_title(user_message.strip(), child_name)

            else:
                response = ""
                response_intent = None

            message = await create_message(
                self.db, self.journal_entry_id, interaction_turn.id,
                response, MessageRole.Assistant, JournalEntryStage.Title,
                metadata_json=metadata,
                intent=response_intent
            )

            return message

        except Exception as e:
            print(f"[DEBUG] title_stage_eng: Error in process_message: {e}")
            import traceback
            traceback.print_exc()
            return None

    async def _save_title(self, title: str) -> None:
        """Save the chosen title to the database."""
        try:
            await update_journal_data(self.db, self.journal_entry_id, title=title)
        except Exception as e:
            print(f"[DEBUG] title_stage_eng: Error saving title: {e}")

    async def _process_title_selection(self, user_message: str, last_assistant_message: Message, child_name: str) -> tuple[str, MessageIntent]:
        """Process user selection among the three titles."""
        titles = last_assistant_message.metadata_json.get("titles", {})

        selected_title = ""
        if user_message in ["1"]:
            selected_title = titles.get("title1", "")
            await self._save_title(selected_title)
        elif user_message in ["2"]:
            selected_title = titles.get("title2", "")
            await self._save_title(selected_title)
        elif user_message in ["3"]:
            selected_title = titles.get("title3", "")
            await self._save_title(selected_title)

        response, response_intent = self.title_generator.process_title_feedback(user_message, selected_title, child_name)
        return response, response_intent

    async def _get_or_create_interaction_turn(self, stage: JournalEntryStage):
        """Get or create the current interaction turn."""
        from backend.database.crud.chatbot import get_latest_interaction_turn, create_interaction_turn

        latest_turn = await get_latest_interaction_turn(self.db, self.journal_entry_id)

        if latest_turn and latest_turn.stage == stage:
            return latest_turn

        return await create_interaction_turn(self.db, self.journal_entry_id, stage)
