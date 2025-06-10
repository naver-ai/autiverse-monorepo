from typing import Optional, Tuple
import jwt
from fastapi import HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from backend.database.models import Dyad
from backend.utils.environment import EnvironmentVariables, get_env_variable

async def verify_token_and_get_dyad(token: str, db: AsyncSession) -> Tuple[Optional[Dyad], Optional[HTTPException]]:
    """
    Verify JWT token and return dyad if valid.
    Returns a tuple of (dyad, error).
    If verification succeeds, error will be None.
    If verification fails, dyad will be None and error will contain the exception.
    """
    try:
        # Decode and verify JWT token
        payload = jwt.decode(
            token, 
            get_env_variable(EnvironmentVariables.APP_AUTH_SECRET), 
            algorithms=['HS256']
        )
        user_id = payload.get("sub")
        
        if not user_id:
            return None, HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        # Find user in database
        dyad = (await db.exec(select(Dyad).where(Dyad.id == user_id))).first()
        if not dyad:
            return None, HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Dyad not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        return dyad, None
        
    except jwt.exceptions.DecodeError:
        return None, HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) 