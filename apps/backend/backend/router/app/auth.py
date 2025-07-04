from typing import Annotated, Literal, Optional
from fastapi import APIRouter, HTTPException, Depends, status, Header
from pydantic import BaseModel
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.database.engine import with_db_session
from backend.database.models import Dyad, DyadInfo, SharableDyad
import jwt
from backend.router.app.common import get_signed_in_dyad
from backend.utils.environment import EnvironmentVariables, get_env_variable
from backend.utils.time import get_timestamp

router = APIRouter()

class LoginRequest(BaseModel):
    passcode: str
    
class AuthenticationResult(BaseModel):
    jwt: str

class AuthenticationResultWithDyad(AuthenticationResult):
    dyad: DyadInfo

class PasscodeAuthRequest(BaseModel):
    passcode: str

class PasscodeAuthResponse(BaseModel):
    dyad: SharableDyad
    message: str

def generate_jwt_token(dyad: Dyad) -> str:
    issued_at = get_timestamp()/1000
    to_encode = {
        "sub": dyad.id,
        "iat": issued_at,
        "exp": issued_at + (365 * 24 * 3600),  # Valid for 1 year
    }
    
    access_token = jwt.encode(
        to_encode, 
        get_env_variable(EnvironmentVariables.APP_AUTH_SECRET), 
        algorithm='HS256'
    )

    return access_token

@router.post("/login", response_model=AuthenticationResultWithDyad)
async def login(request: LoginRequest, db: Annotated[AsyncSession, Depends(with_db_session)], timezone: Annotated[str, Header(..., alias="X-timezone")]):
    # Find user by passcode

    dyad = (await db.exec(select(Dyad).where(Dyad.passcode == request.passcode).limit(1))).first()
    
    if not dyad:
        raise HTTPException(status_code=400, detail="Invalid passcode")
    
    # Generate JWT token
    
    access_token = generate_jwt_token(dyad)
    await db.commit()
    
    return AuthenticationResultWithDyad(jwt=access_token, dyad=dyad.dyad_info)

@router.post("/logout", response_model=bool)
async def logout(db: Annotated[AsyncSession, Depends(with_db_session)], timezone: Annotated[str, Header(..., alias="X-timezone")], 
                 dyad: Annotated[Dyad, Depends(get_signed_in_dyad)]):
    #db.add(InteractionLog(
    #    type=InteractionLogType.USER_LOGOUT,
   #     user_id=user.id,
   #     timezone=timezone,
    #    timestamp=get_timestamp(),
    #    device_id=request.device_id,
   #     metadata_dict=InteractionLogLoginLogoutMetadata(    
    #        **request.model_dump()
    #    ).to_dict(),
    #))
    #await db.commit()
    
    return True


@router.get("/verify", response_model=AuthenticationResult)
async def verify_user(dyad: Annotated[Dyad, Depends(get_signed_in_dyad)]):
    """
    Endpoint to verify if the user is authenticated.
    If the user is authenticated, it returns a 200 OK response.
    """
    return AuthenticationResult(jwt=generate_jwt_token(dyad))