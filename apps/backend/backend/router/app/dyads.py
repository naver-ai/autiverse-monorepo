from fastapi import APIRouter, Depends, HTTPException, Header
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated

from ...database.engine import with_db_session
from ...database.models import Dyad, Agent

router = APIRouter()

async def verify_passcode(
    authorization: Annotated[str, Header()],
    db: Annotated[AsyncSession, Depends(with_db_session)]
) -> Dyad:
    """Verify passcode from Authorization header"""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    passcode = authorization[7:]  # Remove "Bearer " prefix
    
    dyad = (await db.exec(select(Dyad).where(Dyad.passcode == passcode))).first()
    if not dyad:
        raise HTTPException(status_code=401, detail="Invalid passcode")
    
    return dyad

@router.get("/{dyad_id}")
async def get_dyad(
    dyad_id: str,
    db: Annotated[AsyncSession, Depends(with_db_session)],
    dyad: Annotated[Dyad, Depends(verify_passcode)]
):
    # Verify that the dyad_id matches the authenticated dyad
    if dyad.id != dyad_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Calculate visit count based on journal entries
    visit_count = len(dyad.journal_entries)
    
    return {
        "id": dyad.id,
        "alias": dyad.alias,
        "child_name": dyad.child_name,
        "visit_count": visit_count,
        "agent_id": dyad.agents[0].id if dyad.agents else None
    } 