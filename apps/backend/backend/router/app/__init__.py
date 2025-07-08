from fastapi import APIRouter, Depends
from . import chatbot, auth, profile, agents, comic_generation, tts
from .common import get_signed_in_dyad

router = APIRouter()

router.include_router(auth.router, prefix="/auth")
# router.include_router(chatbot.router, prefix="/chatbot", dependencies=[Depends(get_signed_in_dyad)])
router.include_router(chatbot.router, prefix="/chatbot")
router.include_router(profile.router, prefix="/profile", dependencies=[Depends(get_signed_in_dyad)])
router.include_router(agents.router, prefix="/agents", dependencies=[Depends(get_signed_in_dyad)])
# router.include_router(comic_generation.router, prefix="/comic-generation", dependencies=[Depends(get_signed_in_dyad)])
router.include_router(comic_generation.router, prefix="/comic-generation")
router.include_router(tts.router, prefix="/tts")