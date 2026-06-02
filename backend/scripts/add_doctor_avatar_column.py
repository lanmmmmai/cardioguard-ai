import asyncio
import os
import sys

# Add backend directory to sys.path
sys.path.append(os.path.abspath('/Users/doanlan/CNST/cardioguard-ai/backend'))

from app.core.database import database

async def main():
    print("Connecting to database...")
    await database.connect()
    try:
        print("Adding column avatar_url to doctor_profiles table...")
        await database.execute("ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;")
        print("Column added successfully!")
    except Exception as e:
        print(f"Error altering table: {e}")
    finally:
        await database.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
