"""Unit tests for core/sqlalchemy_async.py — URL conversion and engine creation.

Run: python -m unittest tests.test_core_sqlalchemy
"""

import os, sys, unittest
from unittest.mock import patch
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")


class TestAsyncDatabaseUrl(unittest.TestCase):
    """Tests for async_database_url URL conversion."""

    def _call_furl(self, url):
        with patch("app.core.sqlalchemy_async.settings") as mock_settings:
            mock_settings.DATABASE_URL = url
            from app.core.sqlalchemy_async import async_database_url
            return async_database_url()

    def test_asyncpg_url_unchanged(self):
        result = self._call_furl("postgresql+asyncpg://user:pass@localhost/db")
        self.assertEqual(result, "postgresql+asyncpg://user:pass@localhost/db")

    def test_postgresql_url_converted(self):
        result = self._call_furl("postgresql://user:pass@localhost/db")
        self.assertEqual(result, "postgresql+asyncpg://user:pass@localhost/db")

    def test_postgres_url_converted(self):
        result = self._call_furl("postgres://user:pass@localhost/db")
        self.assertEqual(result, "postgresql+asyncpg://user:pass@localhost/db")

    def test_unknown_scheme_unchanged(self):
        result = self._call_furl("sqlite:///test.db")
        self.assertEqual(result, "sqlite:///test.db")


class TestAsyncEngine(unittest.TestCase):
    """Tests that async_database_url converts URLs correctly."""

    def test_url_conversion_uses_async_database_url(self):
        from app.core.sqlalchemy_async import async_database_url
        url = async_database_url()
        self.assertTrue(url.startswith("postgresql+asyncpg://"))


if __name__ == "__main__":
    unittest.main()
