from databases import Database
from app.core.config import settings

database = Database(
    settings.DATABASE_URL,
    statement_cache_size=0
)


async def connect_db():
    await database.connect()


async def disconnect_db():
    await database.disconnect()