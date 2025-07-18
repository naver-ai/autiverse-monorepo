import asyncio
import questionary
from backend.database.engine import engine
from sqlmodel import SQLModel

if __name__ == "__main__":

    if not questionary.confirm("Are you sure you want to delete the database?").ask():
        print("Operation cancelled.")
        exit(0)

    async def reset_db():
        async with engine.begin() as conn:
            await conn.run_sync(SQLModel.metadata.drop_all)
            await conn.run_sync(SQLModel.metadata.create_all)
        print("Database reset.")

    asyncio.run(reset_db())