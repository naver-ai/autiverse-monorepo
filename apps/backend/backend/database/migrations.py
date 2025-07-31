from sqlalchemy import inspect, text
from backend.database.engine import sync_engine
from backend.utils.environment import get_database_type, EnvironmentVariables

def migrate():
    """
    Check if avatar_config column exists in dyad table and add it if it doesn't exist.
    Supports both SQLite and PostgreSQL.
    """
    # Get database inspector using sync engine
    inspector = inspect(sync_engine)
    
    # Check if dyad table exists
    if not inspector.has_table("dyad"):
        print("Dyad table does not exist. Skipping avatar_config migration.")
        return
    
    # Check if avatar_config column exists in dyad table
    columns = [col['name'] for col in inspector.get_columns("dyad")]
    
    if "avatar_config" not in columns:
        print("Adding avatar_config column to dyad table...")
        
        database_type = get_database_type()
        
        with sync_engine.begin() as conn:
            if database_type == EnvironmentVariables.DATABASE_TYPE_SQLITE:
                # SQLite doesn't have native JSON type, use TEXT instead
                conn.execute(text("""
                    ALTER TABLE dyad 
                    ADD COLUMN avatar_config TEXT
                """))
            elif database_type == EnvironmentVariables.DATABASE_TYPE_POSTGRES:
                # PostgreSQL supports JSON type
                conn.execute(text("""
                    ALTER TABLE dyad 
                    ADD COLUMN avatar_config JSON
                """))
            else:
                raise ValueError(f"Unsupported database type: {database_type}")
        
        print("✅ avatar_config column added successfully.")
    else:
        print("ℹ️ avatar_config column already exists in dyad table.") 