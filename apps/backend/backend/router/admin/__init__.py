from fastapi import APIRouter, Depends
from backend.router.admin.common import check_admin_credential
from . import auth, dyads

router = APIRouter()

router.include_router(auth.router, prefix="/auth")
router.include_router(dyads.router, prefix="/dyads", dependencies=[Depends(check_admin_credential)])