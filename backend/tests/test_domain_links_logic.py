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

from app.api.cms_api import (  # noqa: E402
    domain_links_default_payload,
    normalize_domain_link_payload,
    normalize_domain_path,
)
from app.services.db_optimization import ensure_domain_links_schema  # noqa: E402


class TestDomainLinksNormalization(unittest.TestCase):
    def test_normalize_domain_path(self):
        self.assertEqual(normalize_domain_path("login"), "/login")
        self.assertEqual(normalize_domain_path("/login/"), "/login")
        self.assertEqual(normalize_domain_path(""), "/")

    def test_normalize_domain_link_payload(self):
        payload = normalize_domain_link_payload(
            {
                "path": "login",
                "url": "",
                "domain": "",
                "title": "Test",
                "description": "Desc",
                "image_url": "https://giatky.site/image.png",
            }
        )
        self.assertEqual(payload["path"], "/login")
        self.assertEqual(payload["url"], "https://giatky.site/login")
        self.assertEqual(payload["domain"], "giatky.site")

    def test_domain_links_default_payload_uses_public_legal_preview(self):
        about_payload = domain_links_default_payload("/gioi-thieu")
        deletion_payload = domain_links_default_payload("/yeu-cau-xoa-du-lieu")

        self.assertEqual(about_payload["path"], "/gioi-thieu")
        self.assertEqual(about_payload["url"], "https://giatky.site/gioi-thieu")
        self.assertIn("Giới thiệu", about_payload["title"])
        self.assertEqual(deletion_payload["path"], "/yeu-cau-xoa-du-lieu")
        self.assertIn("Yêu cầu xóa dữ liệu", deletion_payload["title"])


class TestDomainLinksSchemaSync(unittest.IsolatedAsyncioTestCase):
    @patch("app.services.db_optimization.database")
    async def test_schema_sync_skips_when_current(self, mock_db):
        mock_db.fetch_val = AsyncMock(side_effect=[True, True, True, True, True, True, True])
        mock_db.execute = AsyncMock()

        await ensure_domain_links_schema()

        mock_db.execute.assert_not_awaited()

    @patch("app.services.db_optimization.database")
    async def test_schema_sync_runs_when_columns_missing(self, mock_db):
        mock_db.fetch_val = AsyncMock(side_effect=[False, True, True, True, True, True, True])
        mock_db.fetch_one = AsyncMock(return_value=None)
        mock_db.fetch_all = AsyncMock(return_value=[])
        mock_db.execute = AsyncMock()

        await ensure_domain_links_schema()

        self.assertGreater(mock_db.execute.await_count, 0)


if __name__ == "__main__":
    unittest.main()
