import logging
from databases import Database
from app.core.config import settings

logger = logging.getLogger(__name__)

database = Database(
    settings.DATABASE_URL,
    statement_cache_size=0
)


async def connect_db():
    logger.info("Connecting to database...")
    try:
        await database.connect()
        logger.info("Database connected successfully")
    except Exception as e:
        logger.exception("Database connection failed")
        raise


async def disconnect_db():
    logger.info("Disconnecting from database...")
    try:
        await database.disconnect()
        logger.info("Database disconnected successfully")
    except Exception as e:
        logger.exception("Database disconnection error")