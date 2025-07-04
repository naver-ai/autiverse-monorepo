from typing import Annotated
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from backend.database.models import Dyad, SharableDyad
from backend.router.app.common import get_signed_in_dyad

router = APIRouter()

@router.get("/info", response_model=SharableDyad)
async def get_me(dyad: Annotated[Dyad, Depends(get_signed_in_dyad)]):
    return dyad.to_sharable()