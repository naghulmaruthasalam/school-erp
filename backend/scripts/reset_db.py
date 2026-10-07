"""Reset all databases - run this to start fresh."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

async def reset_databases():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    
    # List all databases
    db_names = await client.list_database_names()
    base_name = settings.mongodb_db_name
    
    # Drop all related databases
    for db_name in db_names:
        if db_name.startswith(base_name):
            print(f"Dropping database: {db_name}")
            await client.drop_database(db_name)
    
    print("All databases cleaned!")
    client.close()

if __name__ == "__main__":
    asyncio.run(reset_databases())
