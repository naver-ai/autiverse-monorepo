from fastapi import APIRouter, Depends
from . import chatbot, auth, profile
from .common import get_signed_in_dyad

router = APIRouter()

router.include_router(auth.router, prefix="/auth")
router.include_router(chatbot.router, prefix="/chatbot", dependencies=[Depends(get_signed_in_dyad)])
router.include_router(profile.router, prefix="/profile", dependencies=[Depends(get_signed_in_dyad)])