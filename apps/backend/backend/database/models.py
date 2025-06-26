from datetime import datetime
from enum import StrEnum
from nanoid import generate
from typing import Optional
from pydantic import BaseModel, ConfigDict
from sqlmodel import DateTime, Relationship, SQLModel, Field, func, UniqueConstraint, Column, JSON
import json
from backend.utils.time import get_timestamp

def generate_id() -> str:
    return generate()

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
    created_timestamp: int = Field(nullable=False, default_factory=get_timestamp)



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

    locale: UserLocale = Field(nullable=False)
    caregiver_type: CaregiverType = Field(nullable=False)
    child_gender: ChildGender = Field(nullable=False)
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
    interests: list['Interest'] = Field(default_factory=list)

class Dyad(SQLModel, DyadInfo, table=True):
    alias: str = Field(nullable=False)
    passcode: str = Field(unique=True, allow_mutation=False, default_factory=lambda: generate('0123456789', size=6))
    
    interests: list['Interest'] = Relationship(back_populates="dyad", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)
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
        )
    
    @property
    def dyad_info(self) -> DyadInfo:
        return DyadInfo(
            **self.model_dump(exclude={"interests", "places", "people"}),
            interests=[interest for interest in self.interests],
            places=[place.to_sharable() for place in self.places],
            people=[person for person in self.people]
        )


class DyadIdMixin(BaseModel):
    dyad_id: str = Field(foreign_key=f"{Dyad.__tablename__}.id")


class PlacePersonLink(SQLModel, IdTimestampMixin, DyadIdMixin, table=True):
    
    person_id: str = Field(foreign_key="person.id")
    place_id: str = Field(foreign_key="place.id")


class ContextEntityBase(BaseModel):

    name: str = Field(nullable=False)

class Interest(SQLModel, ContextEntityBase, IdTimestampMixin, DyadIdMixin, table=True):
    __table_args__ = (
        UniqueConstraint("name", "dyad_id", name="uix_interest_name_dyad_id"),
    )
    dyad: Dyad = Relationship(back_populates="interests", sa_relationship_kwargs={'lazy': 'selectin'})


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
    Drawing="drawing"
    Debriefing="debriefing"

class JournalEntry(SQLModel, IdTimestampMixin, TimezoneTimestampMixin, DyadIdMixin, table=True):
    model_config = ConfigDict(use_enum_values=True)
    
    status: JournalEntryStatus = Field(nullable=False, default=JournalEntryStatus.Initial)

    stage: Optional[JournalEntryStage] = Field(nullable=True, default=None)

    interaction_turns: list['InteractionTurn'] = Relationship(back_populates="journal_entry", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)

    dyad: Dyad = Relationship(back_populates="journal_entries", sa_relationship_kwargs={'lazy': 'selectin'})
    messages: list['Message'] = Relationship(back_populates="journal_entry", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)
    
class JournalEntryIdMixin(BaseModel):
    journal_entry_id: str = Field(foreign_key=f"{JournalEntry.__tablename__}.id")

class InteractionTurn(SQLModel, IdTimestampMixin, JournalEntryIdMixin, table=True):
    model_config = ConfigDict(use_enum_values=True)
    stage: JournalEntryStage = Field(nullable=False)

    journal_entry: JournalEntry = Relationship(back_populates="interaction_turns", sa_relationship_kwargs={'lazy': 'selectin'})

    messages: list['Message'] = Relationship(back_populates="interaction_turn", sa_relationship_kwargs={'lazy': 'selectin'}, cascade_delete=True)

    context_metadata: Optional[dict] = Field(sa_column=Column(JSON, nullable=True), default=None)

class InteractionTurnIdMixin(BaseModel):
    interaction_turn_id: str = Field(foreign_key=f"{InteractionTurn.__tablename__}.id")
    

class MessageRole(StrEnum):
    User="user"
    Assistant="assistant"

class Message(SQLModel, IdTimestampMixin, JournalEntryIdMixin, InteractionTurnIdMixin, table=True):
    model_config = ConfigDict(use_enum_values=True)

    content: str = Field(nullable=False)
    role: MessageRole = Field(nullable=False)

    audio_filename: Optional[str] = Field(nullable=True, default=None)
    
    interaction_turn: InteractionTurn = Relationship(back_populates="messages", sa_relationship_kwargs={'lazy': 'selectin'})

    journal_entry: JournalEntry = Relationship(back_populates="messages", sa_relationship_kwargs={'lazy': 'selectin'})

    metadata_json: Optional[dict] = Field(sa_column=Column(JSON, name='metadata', nullable=True), default=None)

    @property
    def stage(self)->JournalEntryStage:
        return self.interaction_turn.stage
