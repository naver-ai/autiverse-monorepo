from fastapi import APIRouter
import asyncio
from backend.backup import dump_data
from fastapi.responses import FileResponse
from backend.database.engine import with_db_session
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated
from fastapi import Depends
from backend.database.models import Dyad, JournalEntry, Journal, Message, Comic, InteractionTurn
from sqlmodel import select
from time import perf_counter


router = APIRouter()

@router.get("/export/db", response_class=FileResponse)    
async def download_db_dump():
    file_path = await asyncio.to_thread(dump_data)
    return FileResponse(file_path, media_type="application/zip")


@router.get("/export/json")
async def _export_json(db: Annotated[AsyncSession, Depends(with_db_session)]):
    
    ts = perf_counter()

    dyads = (await db.exec(select(Dyad))).all()
    dyads = [dyad.to_sharable() for dyad in dyads]

    journal_entries = (await db.exec(select(JournalEntry))).all()
    journal_entries = [journal_entry.to_sharable() for journal_entry in journal_entries]

    messages = (await db.exec(select(Message))).all()
    messages = [message.model_dump(mode="json") for message in messages]

    turns = (await db.exec(select(InteractionTurn))).all()
    turns = [turn.model_dump(mode="json") for turn in turns]

    journals = (await db.exec(select(Journal))).all()
    journals = [journal.model_dump(mode="json") for journal in journals]

    comics = (await db.exec(select(Comic))).all()
    comics = [comic.model_dump(mode="json") for comic in comics]

    return {
        "dyads": dyads,
        "journal_entries": journal_entries,
        "messages": messages,
        "turns": turns,
        "journals": journals,
        "comics": comics
    }