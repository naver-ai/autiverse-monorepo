from typing import Any
import socketio
from backend.database.crud.auth import verify_token_and_get_dyad
from backend.database.engine import db_sessionmaker
from backend.database.models import Comic, ComicStatus
from backend.router.admin.common import verify_admin_token
import json

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    cors_credentials=True,
)
socket_app = socketio.ASGIApp(sio)

connected_admins: list[str] = []

# Store connected dyads
connected_dyads: dict[str, str] = {}  # sid -> dyad_id
dyad_sids: dict[str, set[str]] = {}  # dyad_id -> set of sids

@sio.event
async def connect(sid, environ, auth):
    try:
        print(f"New connection: {sid}, auth: {auth}")

        token = auth.get('token')


        if auth.get('type') == 'admin':
            if not verify_admin_token(token):
                return False
            connected_admins.append(sid)
            await sio.emit('admin_connected', {'sid': sid})
            return True
        
        # Get database session
        async with db_sessionmaker() as session:
            dyad, error = await verify_token_and_get_dyad(token, session)
            if error:
                print(f"Token verification failed: {error}")
                return False
            
            # Store dyad connection
            connected_dyads[sid] = dyad.id
            if dyad.id not in dyad_sids:
                dyad_sids[dyad.id] = set()
            dyad_sids[dyad.id].add(sid)
            
            await sio.emit('dyad_connected', {
                'dyad_id': dyad.id,
                'child_name': dyad.child_name,
                'alias': dyad.alias,
            }, to=sid)
            
            return True
    except Exception as e:
        print(f"Error in connect handler: {str(e)}")
        return False

@sio.event
async def disconnect(sid):
    if sid in connected_admins:
        connected_admins.remove(sid)
        await sio.emit('admin_disconnected', {'sid': sid})
        return True
    
    if sid in connected_dyads:
        dyad_id = connected_dyads[sid]
        del connected_dyads[sid]
        
        if dyad_id in dyad_sids:
            dyad_sids[dyad_id].remove(sid)
            if not dyad_sids[dyad_id]:
                del dyad_sids[dyad_id]
        
        await sio.emit('dyad_disconnected', {'dyad_id': dyad_id})

async def emit_to_admin(event: str, data: Any):
    for sid in connected_admins:
        print(f"Emitting event {event} to admin {sid}")
        await sio.emit(event, data, room=sid)

async def emit_to_dyad(dyad_id: str, event: str, data: Any):
    """Emit event to specific dyad"""
    if dyad_id in dyad_sids:
        for sid in dyad_sids[dyad_id]:
            print(f"Emitting event {event} to dyad {dyad_id} with sid {sid}")
            await sio.emit(event, data, room=sid)

    await emit_to_admin(event, data)


async def emit_comic_generation_progress(dyad_id: str, journal_entry_id: str, status: ComicStatus, comic_data: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_progress", {"journal_entry_id": journal_entry_id, "status": status, "comic_data": comic_data})

async def emit_comic_generation_completed(dyad_id: str, journal_entry_id: str, comic_data: dict | None = None, chatbot_response: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_completed", {"journal_entry_id": journal_entry_id, "status": ComicStatus.Completed, "comic_data": comic_data, "chatbot_response": chatbot_response})

async def emit_comic_generation_started(dyad_id: str, journal_entry_id: str, comic_data: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_started", {"journal_entry_id": journal_entry_id, "status": ComicStatus.Generating0, "comic_data": comic_data})

async def emit_comic_generation_error(dyad_id: str, journal_entry_id: str, comic_data: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_error", {"journal_entry_id": journal_entry_id, "status": ComicStatus.Error, "comic_data": comic_data})