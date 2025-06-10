from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.database.engine import with_db_session, engine
from backend.database.models import Dyad, Person, Place, PlacePersonLink, UserLocale, CaregiverType, ChildGender, SharableDyad, SharablePlace
from backend.database.models import Interest
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
 
@router.post("/{dyad_id}/people/add", response_model=Person)
async def add_person(dyad_id: str, args: ContextEntityCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = Person(
        name=args.name,
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


@router.post("/{dyad_id}/places/add", response_model=SharablePlace)
async def add_place(dyad_id: str, args: ContextEntityCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = Place(
        name=args.name,
        dyad_id=dyad_id
    )
    db.add(entity_orm)
    await db.commit()
    await db.refresh(entity_orm)
    return entity_orm.to_sharable()

@router.delete("/{dyad_id}/places/{place_id}")
async def delete_place(dyad_id: str, place_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = await db.get(Place, place_id)
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Place not found")
    await db.delete(entity_orm)
    await db.commit()

@router.post("/{dyad_id}/interests/add", response_model=Interest)
async def add_interest(dyad_id: str, args: ContextEntityCreate, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = Interest(
        name=args.name,
        dyad_id=dyad_id
    )
    db.add(entity_orm)
    await db.commit()
    await db.refresh(entity_orm)
    return entity_orm

@router.delete("/{dyad_id}/interests/{interest_id}")
async def delete_interest(dyad_id: str, interest_id: str, db: Annotated[AsyncSession, Depends(with_db_session)]):
    entity_orm = await db.get(Interest, interest_id)
    if not entity_orm or entity_orm.dyad_id != dyad_id:
        raise HTTPException(status_code=404, detail="Interest not found")
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