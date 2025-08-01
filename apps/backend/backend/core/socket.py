from typing import Any
import socketio
from socketio.async_redis_manager import AsyncRedisManager
from backend.database.crud.auth import verify_token_and_get_dyad
from backend.database.engine import db_sessionmaker
from backend.database.models import Comic, ComicStatus
from backend.router.admin.common import verify_admin_token
import json

redis_manager = AsyncRedisManager('redis://localhost:6379/0', channel='socketio')

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    cors_credentials=True,
    client_manager=redis_manager,
)
socket_app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ, auth):
    try:
        print(f"New connection: {sid}, auth: {auth}")

        token = auth.get('token')

        if auth.get('type') == 'admin':
            if not verify_admin_token(token):
                return False
            await sio.save_session(sid, {'admin': True})
            await sio.enter_room(sid, 'admin')
            await sio.emit('admin_connected', {'sid': sid}, room='admin')
            return True
        
        # Get database session
        async with db_sessionmaker() as session:
            dyad, error = await verify_token_and_get_dyad(token, session)
            if error:
                print(f"Token verification failed: {error}")
                return False
            
            # Store dyad connection
            await sio.save_session(sid, {'dyad': dyad.id})
            await sio.enter_room(sid, dyad.id)
            
            await sio.emit('dyad_connected', {
                'dyad_id': dyad.id,
                'child_name': dyad.child_name,
                'alias': dyad.alias,
            }, room=dyad.id)
            
            return True
    except Exception as e:
        print(f"Error in connect handler: {str(e)}")
        return False

@sio.event
async def disconnect(sid):
    print(f"Disconnecting socket {sid}...")

    try:
        session = await sio.get_session(sid)
        if session:
            if session.get('admin'):
                await sio.emit('admin_disconnected', {'sid': sid}, room='admin')
                await sio.leave_room(sid, 'admin')
                return True
            elif session.get('dyad'):
                dyad_id = session.get('dyad')
                await sio.emit('dyad_disconnected', {'dyad_id': dyad_id}, room=dyad_id)
                await sio.leave_room(sid, dyad_id)
                return True
    except Exception as e:
        print(f"Error in disconnect handler: {str(e)}")
        return False
    
    return False

async def emit_to_admin(event: str, data: Any):
    await sio.emit(event, data, room='admin')

async def emit_to_dyad(dyad_id: str, event: str, data: Any):
    """Emit event to specific dyad"""
    print(f"Trying to emit event {event} to dyad {dyad_id}...")
    await sio.emit(event, data, room=dyad_id)

    await emit_to_admin(event, data)


async def emit_comic_generation_progress(dyad_id: str, journal_entry_id: str, status: ComicStatus, comic_data: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_progress", {"journal_entry_id": journal_entry_id, "status": status, "comic_data": comic_data})

async def emit_comic_generation_completed(dyad_id: str, journal_entry_id: str, comic_data: dict | None = None, chatbot_response: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_completed", {"journal_entry_id": journal_entry_id, "status": ComicStatus.Completed, "comic_data": comic_data, "chatbot_response": chatbot_response})

async def emit_comic_generation_started(dyad_id: str, journal_entry_id: str, comic_data: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_started", {"journal_entry_id": journal_entry_id, "status": ComicStatus.Generating0, "comic_data": comic_data})

async def emit_comic_generation_error(dyad_id: str, journal_entry_id: str, comic_data: dict | None = None):
    await emit_to_dyad(dyad_id, "comic_generation_error", {"journal_entry_id": journal_entry_id, "status": ComicStatus.Error, "comic_data": comic_data})