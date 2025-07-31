from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.database.engine import with_db_session, engine
from backend.database.models import Dyad, Person, Place, PlacePersonLink, UserLocale, CaregiverType, ChildGender, SharableDyad, SharablePlace
from backend.database.models import Agent, JournalEntry, Journal, Message, Comic
from pydantic import BaseModel, Field
from datetime import datetime

router = APIRouter()

@router.get("/all", response_model=list[SharableDyad])
async def get_dyads(db: Annotated[AsyncSession, Depends(with_db_session)]):
    dyads = (await db.exec(select(Dyad).order_by(Dyad.created_at.desc()))).all()

    dyads = [dyad.to_sharable() for dyad in dyads]

    print(dyads)
    return dyads


class DyadCreate(BaseModel):

    locale: UserLocale
    caregiver_type: CaregiverType
    child_gender: ChildGender
    child_name: str
    child_age: int
    alias: str

@router.post("/new", response_model=SharableDyad)
async def create_dyad(dyad: DyadCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    dyad_orm = Dyad(**dyad.model_dump())
    db.add(dyad_orm)
    await db.commit()
    await db.refresh(dyad_orm)

    return dyad_orm.to_sharable()

@router.get("/{dyad_id}", response_model=SharableDyad)
async def get_dyad(dyad_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    dyad_orm = await db.get(Dyad, dyad_id)
    if not dyad_orm:
        raise HTTPException(status_code=404, detail="Dyad not found")
    else:
        return dyad_orm.to_sharable()
    

class ContextEntityCreate(BaseModel):
    name: str

class PersonCreate(BaseModel):
    name: str
    avatar_config: Optional[dict] = None

class AgentCreate(BaseModel):
    interest: str
    agent_name: str
    agent_config: Optional[dict] = None
 
@router.post("/{dyad_id}/people/add", response_model=Person)
async def add_person(dyad_id: str, args: PersonCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = Person(
        name=args.name,
        avatar_config=args.avatar_config,
        dyad_id=dyad_id
    )
    db.add(entity_orm)
    await db.commit()
    await db.refresh(entity_orm)
    return entity_orm

@router.delete("/{dyad_id}/people/{person_id}")
async def delete_person(dyad_id: str, person_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = await db.get(Person, person_id)
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Person not found")
    await db.delete(entity_orm)
    await db.commit()
    return entity_orm


class PersonColorUpdate(BaseModel):
    color: str

@router.put('/{dyad_id}/people/{person_id}/color', response_model=Person)
async def update_person_color(dyad_id: str, person_id: str, args: PersonColorUpdate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = await db.get(Person, person_id)
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Person not found")
    entity_orm.color = args.color
    await db.commit()
    await db.refresh(entity_orm)
    return entity_orm


@router.post("/{dyad_id}/places/add", response_model=SharablePlace)
async def add_place(dyad_id: str, args: ContextEntityCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    try:
        entity_orm = Place(
            name=args.name,
            dyad_id=dyad_id
        )
        db.add(entity_orm)
        await db.commit()
        await db.refresh(entity_orm)
        return entity_orm.to_sharable()
    except Exception as e:
        await db.rollback()
        if "UNIQUE constraint failed" in str(e) and "place.name" in str(e):
            raise HTTPException(
                status_code=409, 
                detail=f"Place with name '{args.name}' already exists in this dyad"
            )
        raise HTTPException(
            status_code=500,
            detail="Failed to create place"
        )

@router.delete("/{dyad_id}/places/{place_id}")
async def delete_place(dyad_id: str, place_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = await db.get(Place, place_id)
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Place not found")
    await db.delete(entity_orm)
    await db.commit()

@router.post("/{dyad_id}/agents/add", response_model=Agent)
async def add_agent(dyad_id: str, args: AgentCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    # 기존 agent가 있는지 확인
    existing_agent = (await db.exec(
        select(Agent).where(Agent.dyad_id == dyad_id, Agent.interest == args.interest)
    )).first()
    
    if existing_agent:
        # 기존 agent 업데이트
        existing_agent.agent_name = args.agent_name
        existing_agent.agent_config = args.agent_config
        await db.commit()
        await db.refresh(existing_agent)
        return existing_agent
    else:
        # 새로운 agent 생성
        entity_orm = Agent(
            interest=args.interest,
            agent_name=args.agent_name,
            agent_config=args.agent_config,
            dyad_id=dyad_id
        )
        db.add(entity_orm)
        await db.commit()
        await db.refresh(entity_orm)
        return entity_orm

@router.delete("/{dyad_id}/agents/{agent_id}")
async def delete_agent(dyad_id: str, agent_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = await db.get(Agent, agent_id)
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(entity_orm)
    await db.commit()
    return entity_orm

class PlaceScheduleCreate(BaseModel):
    day_of_week: int # 0-6, 0 is sunday
    has_schedule: Optional[bool] = None

@router.patch("/{dyad_id}/places/{place_id}/schedule", response_model=SharablePlace)
async def update_place_schedule(dyad_id: str, place_id: str, args: PlaceScheduleCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = await db.get(Place, place_id)
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Place not found")
    if args.day_of_week == 1:
        entity_orm.monday = args.has_schedule
    elif args.day_of_week == 2:
        entity_orm.tuesday = args.has_schedule
    elif args.day_of_week == 3:
        entity_orm.wednesday = args.has_schedule
    elif args.day_of_week == 4:
        entity_orm.thursday = args.has_schedule
    elif args.day_of_week == 5:
        entity_orm.friday = args.has_schedule
    elif args.day_of_week == 6:
        entity_orm.saturday = args.has_schedule
    elif args.day_of_week == 0:
        entity_orm.sunday = args.has_schedule
    else:
        raise HTTPException(status_code=400, detail="Invalid day of week")
    
    await db.commit()
    await db.refresh(entity_orm)
    return entity_orm.to_sharable()

class PlacePersonLinkArgs(BaseModel):
    person_ids: list[str]   

@router.post("/{dyad_id}/places/{place_id}/people/add", response_model=SharablePlace)
async def add_person_to_place(dyad_id: str, place_id: str, args: PlacePersonLinkArgs, db: Annotated[AsyncSession, Depends(with_db_session)]):
    for person_id in args.person_ids:
        entity_orm = PlacePersonLink(
            dyad_id=dyad_id,
            place_id=place_id,
            person_id=person_id
            )
        db.add(entity_orm)
    await db.commit()
    
    place_orm = await db.get(Place, place_id)

    return place_orm.to_sharable()

@router.delete("/{dyad_id}/places/{place_id}/people/{person_id}")
async def delete_person_from_place(dyad_id: str, place_id: str, person_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm: PlacePersonLink = (await db.exec(select(PlacePersonLink).where(PlacePersonLink.place_id == place_id, PlacePersonLink.person_id == person_id))).first()
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Place person link not found")
    await db.delete(entity_orm)
    await db.commit()
    return (await db.get(Place, place_id)).to_sharable()

async def _get_journal_entry_data(journal_entry: JournalEntry, db: AsyncSession):
    """Helper function to get journal entry data with related information"""
    # Get associated journal data
    journal = (await db.exec(
        select(Journal).where(Journal.journal_entry_id == journal_entry.id)
    )).first()
    
    # Get associated comic data
    comic = (await db.exec(
        select(Comic).where(Comic.journal_entry_id == journal_entry.id)
    )).first()
    
    # Get messages for this journal entry
    messages = (await db.exec(
        select(Message)
        .where(Message.journal_entry_id == journal_entry.id)
        .order_by(Message.created_at.asc())
    )).all()
    
    return {
        "id": journal_entry.id,
        "stage": journal_entry.stage,
        "title": journal.title if journal else None,
        "created_at": journal_entry.created_at,
        "updated_at": journal_entry.updated_at,
        "journal": journal.model_dump() if journal else None,
        "comic": comic.model_dump() if comic else None,
        "messages": [message.model_dump() for message in messages]
    }

@router.get("/{dyad_id}/journal-entries")
async def get_dyad_journal_entries(dyad_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    """Get all journal entries for a specific dyad"""
    journal_entries = (await db.exec(
        select(JournalEntry)
        .where(JournalEntry.dyad_id == dyad_id)
        .order_by(JournalEntry.created_at.desc())
    )).all()
    
    result = []
    for entry in journal_entries:
        entry_data = await _get_journal_entry_data(entry, db)
        result.append(entry_data)
    
    return result

@router.get("/{dyad_id}/journal-entries/{journal_entry_id}")
async def get_journal_entry_detail(dyad_id: str, journal_entry_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    """Get detailed information for a specific journal entry"""
    journal_entry = (await db.exec(
        select(JournalEntry)
        .where(JournalEntry.id == journal_entry_id, JournalEntry.dyad_id == dyad_id)
    )).first()
    
    if not journal_entry:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    
    return await _get_journal_entry_data(journal_entry, db)