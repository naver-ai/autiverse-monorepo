import json
import getpass
import psycopg2
from psycopg2.errors import DuplicateDatabase, DuplicateObject

from pydantic import BaseModel
from backend.utils.environment import FilePaths, get_env_variable, EnvironmentVariables, get_database_type
from .models import *

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine

def json_serializer(a):
    return a.model_dump_json() if isinstance(a, BaseModel) else json.dumps(a)


def initialize_postgres_db():

    if get_database_type() != EnvironmentVariables.DATABASE_TYPE_POSTGRES:
        return
    
    print("🔧 Initializing PostgreSQL...")

    # Connect to postgres database as a default user
    conn = psycopg2.connect(dbname="postgres", user=getpass.getuser())
    conn.autocommit = True
    cur = conn.cursor()

    try:
        cur.execute(f"CREATE DATABASE {get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)};")
        print(f"✅ Database '{get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)}' created.")
    except DuplicateDatabase:
        print(f"ℹ️ Database '{get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)}' already exists.")

    try:
        cur.execute(f"CREATE USER {get_env_variable(EnvironmentVariables.POSTGRES_USER)} WITH PASSWORD %s;", (get_env_variable(EnvironmentVariables.POSTGRES_PASSWORD),))
        print(f"✅ User '{get_env_variable(EnvironmentVariables.POSTGRES_USER)}' created.")
    except DuplicateObject:
        print(f"ℹ️ User '{get_env_variable(EnvironmentVariables.POSTGRES_USER)}' already exists.")

    cur.execute(f"GRANT ALL PRIVILEGES ON DATABASE {get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)} TO {get_env_variable(EnvironmentVariables.POSTGRES_USER)};")
    print(f"✅ Privileges granted on '{get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)}' to '{get_env_variable(EnvironmentVariables.POSTGRES_USER)}'.")

    cur.execute(f"ALTER USER {get_env_variable(EnvironmentVariables.POSTGRES_USER)} WITH SUPERUSER;")
    print(f"✅ User '{get_env_variable(EnvironmentVariables.POSTGRES_USER)}' granted superuser privileges.")

    cur.close()
    conn.close()

def create_database_engine(db_path: str, verbose: bool = False) -> AsyncEngine:
    database_type = get_database_type()

    if database_type == EnvironmentVariables.DATABASE_TYPE_SQLITE:
        DATABASE_URL = f"sqlite+aiosqlite:///{FilePaths.get_database_file_path()}"
    elif database_type == EnvironmentVariables.DATABASE_TYPE_POSTGRES:
        DATABASE_URL = f"postgresql+asyncpg://{get_env_variable(EnvironmentVariables.POSTGRES_USER)}:{get_env_variable(EnvironmentVariables.POSTGRES_PASSWORD)}@localhost:5432/{get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)}"
    else:
        raise ValueError(f"Invalid database type: {database_type}")
    
    print(f"Creating database engine with {database_type}...")

    return create_async_engine(DATABASE_URL, echo=verbose, 
                               json_serializer=json_serializer, pool_size=10, max_overflow=20)

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
def create_sync_engine(verbose: bool = False):
    database_type = get_database_type()
    
    if database_type == EnvironmentVariables.DATABASE_TYPE_SQLITE:
        DATABASE_URL = f"sqlite:///{FilePaths.get_database_file_path()}"
    elif database_type == EnvironmentVariables.DATABASE_TYPE_POSTGRES:
        DATABASE_URL = f"postgresql://{get_env_variable(EnvironmentVariables.POSTGRES_USER)}:{get_env_variable(EnvironmentVariables.POSTGRES_PASSWORD)}@localhost:5432/{get_env_variable(EnvironmentVariables.POSTGRES_DB_NAME)}"
    else:
        raise ValueError(f"Invalid database type: {database_type}")
    
    return create_engine(DATABASE_URL, echo=verbose, json_serializer=json_serializer)

sync_engine = create_sync_engine(verbose=False)
sync_sessionmaker = sessionmaker(bind=sync_engine, class_=Session, expire_on_commit=False)

def get_session() -> Session:
    with sync_sessionmaker() as session:
        yield session