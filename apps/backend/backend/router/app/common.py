from typing import Annotated
from fastapi import Depends, HTTPException, status
from sqlmodel import select
from fastapi.security import OAuth2PasswordBearer
from backend.database.engine import with_db_session
from backend.database.models import Dyad
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.database.crud.auth import verify_token_and_get_dyad

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")



async def get_signed_in_dyad(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(with_db_session)
) -> Dyad:
    dyad, error = await verify_token_and_get_dyad(token, db)
    if error:
        raise error
    return dyad