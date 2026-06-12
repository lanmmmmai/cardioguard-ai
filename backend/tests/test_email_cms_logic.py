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

from app.services.db_optimization import ensure_email_cms_schema  # noqa: E402


class TestEmailCmsSchemaSync(unittest.IsolatedAsyncioTestCase):
    @patch("app.services.db_optimization.database")
    async def test_schema_sync_skips_when_current(self, mock_db):
        mock_db.fetch_val = AsyncMock(return_value=True)
        mock_db.execute = AsyncMock()
        mock_db.fetch_one = AsyncMock(return_value=None)

        await ensure_email_cms_schema()

        mock_db.execute.assert_not_awaited()

    @patch("app.services.db_optimization.database")
    async def test_schema_sync_seeds_expected_system_email_functions(self, mock_db):
        mock_db.fetch_all = AsyncMock(return_value=[])
        mock_db.fetch_one = AsyncMock(return_value=None)
        mock_db.execute = AsyncMock()

        await ensure_email_cms_schema()

        function_inserts = []
        for call in mock_db.execute.await_args_list:
            sql = call.args[0] if call.args else ""
            params = call.args[1] if len(call.args) > 1 else None
            if "INSERT INTO cms_email_functions" in sql and isinstance(params, dict):
                function_inserts.append(params["email_type"])

        self.assertEqual(len(function_inserts), 13)
        self.assertIn("doctor_pending_verification", function_inserts)
        self.assertIn("doctor_verified", function_inserts)
        self.assertIn("doctor_rejected", function_inserts)
        self.assertIn("doctor_need_update", function_inserts)
        self.assertNotIn("doctor_profile_require_update", function_inserts)
        self.assertNotIn("doctor_verified_success", function_inserts)
        self.assertNotIn("doctor_verified_rejected", function_inserts)

        sql_statements = [call.args[0] if call.args else '' for call in mock_db.execute.await_args_list]
        self.assertTrue(any("CREATE TABLE IF NOT EXISTS email_logs" in sql for sql in sql_statements))
        self.assertTrue(any("idx_email_logs_status" in sql for sql in sql_statements))
        self.assertTrue(any("idx_email_logs_template_id" in sql for sql in sql_statements))


if __name__ == "__main__":
    unittest.main()
