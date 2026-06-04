"""Unit tests for core/database.py — Database instance and connect/disconnect lifecycle.

Run: python -m unittest tests.test_core_database
"""

import os, sys, unittest
from unittest.mock import AsyncMock, patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")


class TestDatabaseInstance(unittest.TestCase):
    """Tests that the global database instance exists and has expected url."""

    def test_database_url_contains_test_db(self):
        from app.core.database import database
        # database.url is set from settings.DATABASE_URL
        self.assertIn("test_db", str(database.url))


class TestConnectDisconnect(unittest.IsolatedAsyncioTestCase):
    """Tests for connect_db and disconnect_db functions."""

    @patch("app.core.database.database")
    async def test_connect_success(self, mock_db):
        from app.core.database import connect_db
        mock_db.connect = AsyncMock()

        await connect_db()
        mock_db.connect.assert_awaited_once()

    @patch("app.core.database.database")
    async def test_connect_failure_raises(self, mock_db):
        from app.core.database import connect_db
        mock_db.connect = AsyncMock(side_effect=Exception("Connection failed"))

        with self.assertRaises(Exception):
            await connect_db()

    @patch("app.core.database.database")
    async def test_disconnect_success(self, mock_db):
        from app.core.database import disconnect_db
        mock_db.disconnect = AsyncMock()

        await disconnect_db()
        mock_db.disconnect.assert_awaited_once()

    @patch("app.core.database.database")
    async def test_disconnect_failure_raises(self, mock_db):
        from app.core.database import disconnect_db
        mock_db.disconnect = AsyncMock(side_effect=Exception("Disconnect failed"))

        with self.assertRaises(Exception):
            await disconnect_db()


if __name__ == "__main__":
    unittest.main()
