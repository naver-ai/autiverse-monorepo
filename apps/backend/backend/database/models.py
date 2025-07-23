from datetime import datetime
from enum import StrEnum
from nanoid import generate
from typing import Optional
from pydantic import BaseModel, ConfigDict
from sqlmodel import DateTime, Relationship, SQLModel, Field, func, UniqueConstraint, Column, JSON, Enum as SQLEnum
from sqlalchemy import BigInteger
import json
from backend.utils.time import get_timestamp
import uuid

def generate_id() -> str:
    return str(uuid.uuid4())

class IdTimestampMixin(BaseModel):
    id: str = Field(primary_key=True, default_factory=generate_id)
    created_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs=dict(server_default=func.now(), nullable=True)
    )
    updated_at: Optional[datetime] = Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs=dict(server_default=func.now(), onupdate=func.now(), nullable=True)
    )

class TimezoneTimestampMixin(BaseModel):
    created_timezone: str = Field(nullable=True, default=None)
    created_timestamp: int = Field(sa_type=BigInteger, nullable=False, default_factory=get_timestamp)



class CaregiverType(StrEnum):
    Mother="mother"
    Father="father"
    Teacher="teacher"

class ChildGender(StrEnum):
    Boy="boy"
    Girl="girl"

class UserLocale(StrEnum):
    Korean="Korean"
    English="English"


class DyadInfo(IdTimestampMixin):
    model_config = ConfigDict(use_enum_values=True)

    locale: UserLocale = Field(sa_type=SQLEnum(UserLocale, native_enum=False), nullable=False, index=True)
    caregiver_type: CaregiverType = Field(sa_type=SQLEnum(CaregiverType, native_enum=False), nullable=False, index=True)
    child_gender: ChildGender = Field(sa_type=SQLEnum(ChildGender, native_enum=False), nullable=False, index=True)
    child_name: str = Field(nullable=False, min_length=1, max_length=100)
    child_age: int = Field(nullable=False, ge=0)

class SharablePlace(IdTimestampMixin):
    name: str
    people: list['Person'] = Field(default_factory=list)

    monday: Optional[bool] = Field(nullable=True, default=None)
    tuesday: Optional[bool] = Field(nullable=True, default=None)
    wednesday: Optional[bool] = Field(nullable=True, default=None)
    thursday: Optional[bool] = Field(nullable=True, default=None)
    friday: Optional[bool] = Field(nullable=True, default=None)
    saturday: Optional[bool] = Field(nullable=True, default=None)
    sunday: Optional[bool] = Field(nullable=True, default=None)

    people: list['Person'] = Field(default_factory=list)

class SharableDyad(DyadInfo):
    passcode: str
    alias: str

    people: list['Person'] = Field(default_factory=list)
    places: list[SharablePlace] = Field(default_factory=list)
    agents: list['Agent'] = Field(default_factory=list)
    journal_entries: list['JournalEntry'] = Field(default_factory=list)

class Dyad(SQLModel, DyadInfo, table=True):
    alias: str = Field(nullable=False)
    passcode: str = Field(unique=True, allow_mutation=False, default_factory=lambda: generate('0123456789', size=6))
    
    agents: list['Agent'] = Relationship(back_populates="dyad", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)
    places: list['Place'] = Relationship(back_populates="dyad", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)
    people: list['Person'] = Relationship(back_populates="dyad", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)

    journal_entries: list['JournalEntry'] = Relationship(back_populates="dyad", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)

    def to_sharable(self) -> 'SharableDyad':
        return SharableDyad(
            **self.model_dump(include={"id", 
                                                 "passcode", "alias", 
                                                 "created_at", "updated_at", 
                                                 "locale", "caregiver_type", 
                                                 "child_gender", "child_name", "child_age"
                                                 }),
            places=[place.to_sharable() for place in self.places],
            agents=[agent for agent in self.agents],
            people=[person for person in self.people],
            journal_entries=[journal_entry for journal_entry in self.journal_entries]
        )
    
    @property
    def dyad_info(self) -> DyadInfo:
        return DyadInfo(
            **self.model_dump(exclude={"agents", "places", "people", "agents", "journal_entries"})
        )


class DyadIdMixin(BaseModel):
    dyad_id: str = Field(foreign_key=f"{Dyad.__tablename__}.id")


class PlacePersonLink(SQLModel, IdTimestampMixin, DyadIdMixin, table=True):
    
    person_id: str = Field(foreign_key="person.id")
    place_id: str = Field(foreign_key="place.id")


class ContextEntityBase(BaseModel):

    name: str = Field(nullable=False, index=True)

class Agent(SQLModel, IdTimestampMixin, DyadIdMixin, table=True):
    __table_args__ = (
        UniqueConstraint("interest", "dyad_id", name="uix_agent_interest_dyad_id"),
    )
    
    interest: str = Field(nullable=False)
    agent_name: str = Field(nullable=False)
    agent_config: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    
    dyad: Dyad = Relationship(back_populates="agents", sa_relationship_kwargs={'lazy': 'selectin'})

class Place(SQLModel, ContextEntityBase, IdTimestampMixin, DyadIdMixin, table=True):

    __table_args__ = (
        UniqueConstraint("name", "dyad_id", name="uix_place_name_dyad_id"),
    )

    people: list['Person'] = Relationship(back_populates="places", sa_relationship_kwargs={'lazy': 'selectin'}, link_model=PlacePersonLink)

    monday: Optional[bool] = Field(nullable=True, default=None)
    tuesday: Optional[bool] = Field(nullable=True, default=None)
    wednesday: Optional[bool] = Field(nullable=True, default=None)
    thursday: Optional[bool] = Field(nullable=True, default=None)
    friday: Optional[bool] = Field(nullable=True, default=None)
    saturday: Optional[bool] = Field(nullable=True, default=None)
    sunday: Optional[bool] = Field(nullable=True, default=None)

    dyad: Dyad = Relationship(back_populates="places", sa_relationship_kwargs={'lazy': 'selectin'})

    def to_sharable(self) -> 'SharablePlace':
        return SharablePlace(
            **self.model_dump(exclude={"people"}),
            people=[person for person in self.people]
        )

class Person(SQLModel, ContextEntityBase, IdTimestampMixin, DyadIdMixin, table=True):

    __table_args__ = (
        UniqueConstraint("name", "dyad_id", name="uix_person_name_dyad_id"),
    )

    avatar_config: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)

    places: list['Place'] = Relationship(back_populates="people", sa_relationship_kwargs={'lazy': 'selectin'}, link_model=PlacePersonLink)

    dyad: Dyad = Relationship(back_populates="people", sa_relationship_kwargs={'lazy': 'selectin'})

class PersonIdMixin(BaseModel):
    person_id: str = Field(foreign_key=f"{Person.__tablename__}.id")

class PlaceIdMixin(BaseModel):
    place_id: str = Field(foreign_key=f"{Place.__tablename__}.id")


class ProcessingStatus(StrEnum):
    Pending="pending"
    Processing="processing"
    Completed="completed"
    Failed="failed"

class JournalEntryStatus(StrEnum):
    Initial="initial"
    InProgress="in_progress"
    Completed="completed"

class JournalEntryStage(StrEnum):
    Prelim="prelim"
    Intro="intro"
    Revision1="revision_1"
    ComicContext="comic_context"
    Revision2="revision_2"
    Title="title"
    Complete="complete"

class JournalEntry(SQLModel, IdTimestampMixin, TimezoneTimestampMixin, DyadIdMixin, table=True):
    model_config = ConfigDict(use_enum_values=True)
    
    status: JournalEntryStatus = Field(sa_type=SQLEnum(JournalEntryStatus, native_enum=False), nullable=False, default=JournalEntryStatus.Initial)
    stage: Optional[JournalEntryStage] = Field(sa_type=SQLEnum(JournalEntryStage, native_enum=False), nullable=True, default=None)
    whole_audio: Optional[str] = Field(nullable=True, default=None)

    interaction_turns: list['InteractionTurn'] = Relationship(back_populates="journal_entry", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)
    dyad: Dyad = Relationship(back_populates="journal_entries", sa_relationship_kwargs={'lazy': 'selectin'})
    messages: list['Message'] = Relationship(back_populates="journal_entry", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)
    
class JournalEntryIdMixin(BaseModel):
    journal_entry_id: str = Field(foreign_key=f"{JournalEntry.__tablename__}.id")

class InteractionTurn(SQLModel, IdTimestampMixin, JournalEntryIdMixin, table=True):
    model_config = ConfigDict(use_enum_values=True)
    stage: JournalEntryStage = Field(sa_type=SQLEnum(JournalEntryStage, native_enum=False), nullable=False)

    journal_entry: JournalEntry = Relationship(back_populates="interaction_turns", sa_relationship_kwargs={'lazy': 'selectin'})
    messages: list['Message'] = Relationship(back_populates="interaction_turn", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)

    context_metadata: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)

class InteractionTurnIdMixin(BaseModel):
    interaction_turn_id: str = Field(foreign_key=f"{InteractionTurn.__tablename__}.id")
    

class MessageRole(StrEnum):
    User="user"
    Assistant="assistant"

class MessageIntent(StrEnum):
    PromptNext="prompt_next"
    PromptConfirm="prompt_confirm" # Yes / no
    PromptIssueExist="prompt_issue_exist" # 문제가 있는 부분이 있어?
    InitialTitleConfirm="initial_title_confirm" # 첫 번째 제목 제안에 대한 피드백
    CustomTitleConfirm="custom_title_confirm" # 커스텀 제목 확인에 대한 피드백
    PromptOpenEndedAnswer="prompt_open_ended_answer" # 채팅으로 쳐서 정확하게 알려줘!, etc
    PromptTextInput="prompt_text_input"
    PromptEmotion="prompt_emotion"
    Agree="agree"
    Disagree="disagree"
    StartComicGenerationToken="start_comic_generation"
    TransitionToTitle="transition_to_title"

class Message(SQLModel, IdTimestampMixin, JournalEntryIdMixin, InteractionTurnIdMixin, table=True):
    model_config = ConfigDict(use_enum_values=True)

    content: str = Field(nullable=False)
    role: MessageRole = Field(sa_type=SQLEnum(MessageRole, native_enum=False), nullable=False)
    audio_filename: Optional[str] = Field(nullable=True, default=None)
    stage: Optional[JournalEntryStage] = Field(sa_type=SQLEnum(JournalEntryStage, native_enum=False), nullable=True, default=None)
    
    interaction_turn: InteractionTurn = Relationship(back_populates="messages", sa_relationship_kwargs={'lazy': 'selectin'})
    journal_entry: JournalEntry = Relationship(back_populates="messages", sa_relationship_kwargs={'lazy': 'selectin'})

    metadata_json: Optional[dict] = Field(sa_column=Column(JSON, name='metadata', nullable=True), default=None)

    @property
    def stage_property(self)->JournalEntryStage:
        return self.interaction_turn.stage
    
    def set_metadata(self, key: str, value: any):
        new_metadata = {}

        if self.metadata_json is not None:
            new_metadata.update(self.metadata_json)

        new_metadata[key] = value

        self.metadata_json = new_metadata
    
    def set_intent_metadata(self, intent: MessageIntent):
        self.set_metadata("intent", intent.value)

    @property
    def intent(self) -> MessageIntent | None:
        return self.metadata_json.get("intent", None) if self.metadata_json else None

class Journal(SQLModel, IdTimestampMixin, DyadIdMixin, table=True):
    location: Optional[str] = Field(nullable=True, default=None)
    people: Optional[list[str]] = Field(sa_column=Column(JSON, nullable=True), default=None)
    events: Optional[list[str]] = Field(sa_column=Column(JSON, nullable=True), default=None)
    summary: Optional[str] = Field(nullable=True, default=None)
    title: Optional[str] = Field(nullable=True, default=None)
    revision_1_count: int = Field(nullable=False, default=0)
    revision_2_count: int = Field(nullable=False, default=0)
    max_revisions: int = Field(nullable=False)
    comic_intro: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    revision_1: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    comic_context: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    revision_2: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    journal_entry_id: str = Field(foreign_key="journalentry.id")

class JournalIdMixin(BaseModel):
    journal_id: str = Field(foreign_key=f"{Journal.__tablename__}.id")

class Comic(SQLModel, IdTimestampMixin, DyadIdMixin, table=True):
    first_panel1: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    first_panel2: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    first_panel3: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    first_panel4: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    second_panel1: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    second_panel2: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    second_panel3: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    second_panel4: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)
    status: Optional[str] = Field(nullable=True, default=None)
    journal_entry_id: str = Field(foreign_key="journalentry.id")
    journal_id: str = Field(foreign_key="journal.id")

# Comic panel type
class ComicPanel(BaseModel):
    content: str
    grid: list = []

# Comic data type
class ComicData(BaseModel):
    panel1: Optional[ComicPanel | str] = None
    panel2: Optional[ComicPanel | str] = None
    panel3: Optional[ComicPanel | str] = None
    panel4: Optional[ComicPanel | str] = None

# Message type for JournalingSessionInfo
class ChatMessage(BaseModel):
    id: str
    text: str
    isUser: bool
    timestamp: Optional[str] = None
    intent: Optional[MessageIntent] = None
    metadata: Optional[dict] = None

# JournalingSessionInfo type for get_session_info method
class JournalingSessionInfo(BaseModel):
    journal_entry_id: str
    stage: str
    status: str
    location: Optional[str] = None
    people: Optional[list[str]] = None
    events: Optional[list[str]] = None
    summary: Optional[str] = None
    title: Optional[str] = None
    panels: Optional[ComicData] = None
    message_count: int
    focusedPanel: Optional[str] = None
    messages: list[ChatMessage] = []
