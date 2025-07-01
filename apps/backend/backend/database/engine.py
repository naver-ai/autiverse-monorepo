import json
from pydantic import BaseModel
from backend.utils.environment import FilePaths
from .models import *

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine

def json_serializer(a):
    return a.model_dump_json() if isinstance(a, BaseModel) else json.dumps(a)

def create_database_engine(db_path: str, verbose: bool = False) -> AsyncEngine:
    return create_async_engine(f"sqlite+aiosqlite:///{db_path}", echo=verbose, 
                                pool_size=50, max_overflow=100,
                               json_serializer=json_serializer)

def make_async_session_maker(engine: AsyncEngine) -> sessionmaker[AsyncSession]:
    return sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def create_db_and_tables(engine: AsyncEngine):
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

engine = create_database_engine(FilePaths.get_database_file_path(), verbose=False)

db_sessionmaker = make_async_session_maker(engine)

async def with_db_session() -> AsyncSession:
    async with db_sessionmaker() as session:
        yield session

# Synchronous session for chatbot
sync_engine = create_engine(f"sqlite:///{FilePaths.get_database_file_path()}", echo=False, json_serializer=json_serializer)
sync_sessionmaker = sessionmaker(bind=sync_engine, class_=Session, expire_on_commit=False)

def get_session() -> Session:
    with sync_sessionmaker() as session:
        yield session