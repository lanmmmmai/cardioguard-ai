"""Kiểm thử đơn vị cho API Quản lý Cảnh báo (alert_api.py).

Đường dẫn: backend/tests/test_alert_rules.py
"""

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Thiết lập biến môi trường giả lập để nạp config
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.api.alert_api import get_alerts, get_alert_stats_last_7_days, resolve_alert, create_sos_alert, AlertCreate


class TestAlertRules(unittest.IsolatedAsyncioTestCase):
    """Bộ kiểm thử cho các endpoint quản lý cảnh báo và SOS."""

    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_get_alerts_patient(self, mock_db, mock_get_user):
        """Kiểm tra việc lấy danh sách cảnh báo của Bệnh nhân."""
        mock_get_user.return_value = {"id": "patient-uuid-1", "role": "patient"}
        
        mock_db.fetch_val = AsyncMock(return_value=1)
        mock_db.fetch_all = AsyncMock(return_value=[
            {
                "id": "alert-uuid-1",
                "patient_id": "patient-uuid-1",
                "full_name": "Nguyen Van A",
                "alert_type": "HIGH_HEART_RATE",
                "message": "Nhịp tim quá cao",
                "severity": "high",
                "is_resolved": False,
                "created_at": "2026-06-04T16:00:00Z"
            }
        ])

        data = await get_alerts(authorization="Bearer token")
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["items"][0]["patient_id"], "patient-uuid-1")
        # Kiểm tra xem có cast SQL đúng vai trò patient không
        mock_db.fetch_val.assert_called_once()
        self.assertIn("alerts.patient_id = CAST(:user_id AS uuid)", mock_db.fetch_val.call_args[0][0])

    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_get_alerts_doctor(self, mock_db, mock_get_user):
        """Kiểm tra việc lấy danh sách cảnh báo của Bác sĩ quản lý bệnh nhân."""
        mock_get_user.return_value = {"id": "doctor-uuid-1", "role": "doctor"}
        
        mock_db.fetch_val = AsyncMock(return_value=2)
        mock_db.fetch_all = AsyncMock(return_value=[])

        data = await get_alerts(authorization="Bearer token")
        self.assertEqual(data["total"], 2)
        # Kiểm tra xem có kiểm tra sự tồn tại của doctor_patient mapping không
        self.assertIn("EXISTS", mock_db.fetch_val.call_args[0][0])
        self.assertIn("doctor_patient", mock_db.fetch_val.call_args[0][0])

    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_get_alerts_admin(self, mock_db, mock_get_user):
        """Kiểm tra Admin lấy toàn bộ cảnh báo của hệ thống."""
        mock_get_user.return_value = {"id": "admin-uuid-1", "role": "admin"}
        
        mock_db.fetch_val = AsyncMock(return_value=10)
        mock_db.fetch_all = AsyncMock(return_value=[])

        data = await get_alerts(authorization="Bearer token")
        self.assertEqual(data["total"], 10)
        # Đối với Admin, query count không chứa WHERE patient_id hay doctor_patient
        query = mock_db.fetch_val.call_args[0][0]
        self.assertNotIn("alerts.patient_id = CAST", query)
        self.assertNotIn("doctor_patient", query)

    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_get_alert_stats(self, mock_db, mock_get_user):
        """Kiểm tra API thống kê cảnh báo 7 ngày."""
        mock_get_user.return_value = {"id": "patient-uuid-1", "role": "patient"}
        mock_db.fetch_all = AsyncMock(return_value=[
            {"label": "04/06", "count": 2},
            {"label": "03/06", "count": 0}
        ])

        data = await get_alert_stats_last_7_days(authorization="Bearer token")
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]["label"], "04/06")
        self.assertEqual(data[0]["count"], 2)

    @patch("app.api.alert_api.manager")
    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_resolve_alert_patient_own_success(self, mock_db, mock_get_user, mock_manager):
        """Bệnh nhân giải quyết cảnh báo của chính mình thành công."""
        mock_get_user.return_value = {"id": "patient-uuid-1", "role": "patient"}
        
        # mock alert tồn tại
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"patient_id": "patient-uuid-1"}, # Lần 1: check alert.patient_id
            { # Lần 2: trả về alert đã cập nhật để broadcast
                "id": "alert-uuid-1",
                "patient_id": "patient-uuid-1",
                "full_name": "Nguyen Van A",
                "alert_type": "SOS",
                "message": "Help",
                "severity": "critical",
                "is_resolved": True,
                "created_at": "2026-06-04T16:00:00Z"
            }
        ])
        mock_db.execute = AsyncMock()
        mock_manager.broadcast_alert = AsyncMock()

        res = await resolve_alert(alert_id="alert-uuid-1", authorization="Bearer token")
        self.assertEqual(res["message"], "Cảnh báo đã được xác nhận xử lý thành công")
        mock_db.execute.assert_called_once()
        mock_manager.broadcast_alert.assert_called_once()

    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_resolve_alert_other_patient_forbidden(self, mock_db, mock_get_user):
        """Bệnh nhân không thể giải quyết cảnh báo của người khác."""
        mock_get_user.return_value = {"id": "patient-uuid-1", "role": "patient"}
        mock_db.fetch_one = AsyncMock(return_value={"patient_id": "other-patient-uuid"})

        with self.assertRaises(HTTPException) as ctx:
            await resolve_alert(alert_id="alert-uuid-1", authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("không có quyền", ctx.exception.detail)

    @patch("app.api.alert_api.manager")
    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_resolve_alert_assigned_doctor_success(self, mock_db, mock_get_user, mock_manager):
        """Bác sĩ được phân công giải quyết cảnh báo của bệnh nhân thành công."""
        mock_get_user.return_value = {"id": "doctor-uuid-1", "role": "doctor"}
        
        # Mock check alert + doctor_patient assignment + updated alert
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"patient_id": "patient-uuid-1"}, # 1. Get alert
            {"doctor_id": "doctor-uuid-1", "patient_id": "patient-uuid-1"}, # 2. Assigned check
            { # 3. Get updated alert
                "id": "alert-uuid-1",
                "patient_id": "patient-uuid-1",
                "full_name": "Nguyen Van A",
                "alert_type": "SOS",
                "message": "Help",
                "severity": "critical",
                "is_resolved": True,
                "created_at": "2026-06-04T16:00:00Z"
            }
        ])
        mock_db.execute = AsyncMock()
        mock_manager.broadcast_alert = AsyncMock()

        res = await resolve_alert(alert_id="alert-uuid-1", authorization="Bearer token")
        self.assertEqual(res["alert_id"], "alert-uuid-1")
        mock_db.execute.assert_called_once()

    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_resolve_alert_unassigned_doctor_forbidden(self, mock_db, mock_get_user):
        """Bác sĩ chưa được phân công không thể giải quyết cảnh báo của bệnh nhân."""
        mock_get_user.return_value = {"id": "doctor-uuid-1", "role": "doctor"}
        
        mock_db.fetch_one = AsyncMock(side_effect=[
            {"patient_id": "patient-uuid-1"}, # 1. Get alert
            None # 2. Not assigned doctor
        ])

        with self.assertRaises(HTTPException) as ctx:
            await resolve_alert(alert_id="alert-uuid-1", authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("chưa được phân công", ctx.exception.detail)

    @patch("app.api.alert_api.manager")
    @patch("app.api.alert_api.get_user_from_token")
    @patch("app.api.alert_api.database")
    async def test_create_sos_alert_patient_success(self, mock_db, mock_get_user, mock_manager):
        """Bệnh nhân tạo cảnh báo SOS thành công."""
        mock_get_user.return_value = {"id": "patient-uuid-1", "role": "patient"}
        
        mock_db.execute = AsyncMock()
        mock_db.fetch_one = AsyncMock(return_value={
            "id": "new-alert-uuid",
            "patient_id": "patient-uuid-1",
            "full_name": "Nguyen Van A",
            "alert_type": "SOS",
            "message": "SOS Emergency",
            "severity": "critical",
            "is_resolved": False,
            "created_at": "2026-06-04T16:00:00Z"
        })
        mock_manager.broadcast_alert = AsyncMock()

        payload = AlertCreate(message="SOS Emergency")
        data = await create_sos_alert(payload=payload, authorization="Bearer token")
        self.assertEqual(data["alert_type"], "SOS")
        self.assertEqual(data["severity"], "critical")
        mock_db.execute.assert_called_once()
        mock_manager.broadcast_alert.assert_called_once()

    @patch("app.api.alert_api.get_user_from_token")
    async def test_create_sos_alert_doctor_forbidden(self, mock_get_user):
        """Bác sĩ hoặc Admin không được phép tự kích hoạt SOS."""
        mock_get_user.return_value = {"id": "doctor-uuid-1", "role": "doctor"}
        
        payload = AlertCreate(message="SOS Emergency")
        with self.assertRaises(HTTPException) as ctx:
            await create_sos_alert(payload=payload, authorization="Bearer token")
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("Chỉ bệnh nhân mới có thể gửi cảnh báo SOS", ctx.exception.detail)


if __name__ == "__main__":
    unittest.main()
