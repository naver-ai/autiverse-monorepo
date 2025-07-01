from fastapi import APIRouter, Depends, HTTPException, Header
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import Annotated

from ...database.engine import with_db_session
from ...database.models import Agent, Dyad

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

@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    db: Annotated[AsyncSession, Depends(with_db_session)],
    dyad: Annotated[Dyad, Depends(verify_passcode)]
):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    
    # Verify that the agent belongs to the authenticated dyad
    if agent.dyad_id != dyad.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return {
        "id": agent.id,
        "name": agent.agent_name,
        "description": f"{agent.interest} 전문가",
        "interest": agent.interest,
        "agent_config": agent.agent_config or {}
    } 