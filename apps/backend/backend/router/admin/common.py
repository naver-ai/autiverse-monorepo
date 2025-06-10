from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from backend.utils.environment import EnvironmentVariables, get_env_variable


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_admin_token(token: str)->bool:
    try:
        payload = jwt.decode(token, get_env_variable(EnvironmentVariables.APP_AUTH_SECRET), algorithms=['HS256'])
        admin_id = payload.get("sub")
        return admin_id == get_env_variable(EnvironmentVariables.ADMIN_ID)
    except jwt.exceptions.DecodeError as ex:
        return False

async def check_admin_credential(token: Annotated[str, Depends(oauth2_scheme)])->bool:

    exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate admin authorization header",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, get_env_variable(EnvironmentVariables.APP_AUTH_SECRET), algorithms=['HS256'])
        admin_id = payload.get("sub")

        print(payload, get_env_variable(EnvironmentVariables.ADMIN_ID))

        if admin_id == get_env_variable(EnvironmentVariables.ADMIN_ID):
            return True
        else:
            raise exception
    except jwt.exceptions.DecodeError as ex:
        print(ex)
        raise exception from ex