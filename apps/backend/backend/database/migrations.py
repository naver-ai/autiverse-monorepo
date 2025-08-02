import asyncio
from sqlalchemy import inspect, text
from backend.database.engine import engine
from backend.utils.environment import get_database_type, EnvironmentVariables

async def migrate():
    """
    Check if avatar_config column exists in dyad table and add it if it doesn't exist.
    Supports both SQLite and PostgreSQL.
    """
    # Get database inspector using async engine
    async with engine.begin() as conn:
        # Check if dyad table exists
        result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='dyad'"))
        if not result.fetchone():
            print("Dyad table does not exist. Skipping avatar_config migration.")
            return
        
        # Check if avatar_config column exists in dyad table
        result = await conn.execute(text("PRAGMA table_info(dyad)"))
        columns = [row[1] for row in result.fetchall()]
        
        if "avatar_config" not in columns:
            print("Adding avatar_config column to dyad table...")
            
            database_type = get_database_type()
            
            if database_type == EnvironmentVariables.DATABASE_TYPE_SQLITE:
                # SQLite doesn't have native JSON type, use TEXT instead
                await conn.execute(text("""
                    ALTER TABLE dyad 
                    ADD COLUMN avatar_config TEXT
                """))
            elif database_type == EnvironmentVariables.DATABASE_TYPE_POSTGRES:
                # PostgreSQL supports JSON type
                await conn.execute(text("""
                    ALTER TABLE dyad 
                    ADD COLUMN avatar_config JSON
                """))
            else:
                raise ValueError(f"Unsupported database type: {database_type}")
            
            print("✅ avatar_config column added successfully.")
        else:
            print("ℹ️ avatar_config column already exists in dyad table.")

def run_migrate():
    """Synchronous wrapper for async migrate function"""
    asyncio.run(migrate()) 