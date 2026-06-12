"""Regression tests for CRUD API response contracts.

These tests lock the list response shape used by web and mobile clients so
future backend changes do not silently break both applications.
"""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.api import crud_api  # noqa: E402


class TestCrudApiContract(unittest.IsolatedAsyncioTestCase):
    """Lock the paginated envelope returned by generic CRUD list endpoints."""

    async def test_list_records_returns_paginated_envelope(self):
        rows = [
            {"id": "1", "title": "First"},
            {"id": "2", "title": "Second"},
        ]

        with (
            patch.object(crud_api, "get_user_from_token", AsyncMock(return_value={"id": "admin-1", "role": "admin"})),
            patch.object(crud_api, "table_columns", AsyncMock(return_value={"id", "title", "created_at"})),
            patch.object(crud_api, "access_filter", return_value=("", {})),
            patch.object(crud_api.database, "fetch_val", AsyncMock(return_value=2)),
            patch.object(crud_api.database, "fetch_all", AsyncMock(return_value=rows)),
        ):
            result = await crud_api.list_records("reports", "Bearer token", 25, 10)

        self.assertEqual(result["items"], rows)
        self.assertEqual(result["total"], 2)
        self.assertEqual(result["limit"], 25)
        self.assertEqual(result["offset"], 10)


if __name__ == "__main__":
    unittest.main()
