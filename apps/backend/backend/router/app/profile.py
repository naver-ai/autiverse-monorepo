from typing import Annotated
from fastapi import APIRouter, Depends
from backend.database.models import Dyad, DyadInfo
from backend.router.app.common import get_signed_in_dyad

router = APIRouter()


@router.get("/info", response_model=DyadInfo)
async def get_me(dyad: Annotated[Dyad, Depends(get_signed_in_dyad)]):
    return dyad.dyad_info