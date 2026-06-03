"""API Tính năng và Phân tích Sức khỏe.

Mục đích:
    Cung cấp các endpoint tính năng cấp hệ thống: tổng quan bảng điều khiển
    và bản giữ chỗ phân tích sức khỏe AI. Các endpoint này cung cấp
    cái nhìn tổng quan cấp cao về trạng thái hệ thống và bản mẫu cho tích
    hợp mô hình AI trong tương lai.

Luồng xử lý:
    GET /dashboard/summary trả về trạng thái hệ thống hiện tại, các module
    có sẵn và tuyên bố miễn trừ AI. POST /ai/health-analysis chấp nhận
    dữ liệu đầu vào tùy ý và trả về phản hồi giữ chỗ; chỉ
    admin và bác sĩ mới có thể truy cập.

Quan hệ:
    - Phụ thuộc vào: auth_api.get_user_from_token để xác thực
    - Cung cấp: Bảng điều khiển giao diện với các chỉ số sức khỏe hệ thống
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app.api.auth_api import get_user_from_token

router = APIRouter()

AI_DISCLAIMER = "Kết quả AI chỉ mang tính tham khảo, cần bác sĩ xác nhận."


@router.get("/dashboard/summary")
async def dashboard_summary(authorization: Optional[str] = Header(default=None)):
    """Lấy tổng quan bảng điều khiển hệ thống với trạng thái module.

    Trả về trạng thái thời gian chạy hiện tại, các module tính năng có sẵn và
    tuyên bố miễn trừ AI. Yêu cầu bất kỳ xác thực hợp lệ nào.

    Args:
        authorization: Token Bearer.

    Returns:
        Dict chứa status, dấu thời gian generated_at, danh sách modules và disclaimer.
    """
    await get_user_from_token(authorization)
    return {
        "status": "running",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "modules": ["auth", "patients", "realtime", "alerts", "appointments", "records", "iot", "reports", "ai"],
        "ai_disclaimer": AI_DISCLAIMER,
    }


@router.post("/ai/health-analysis")
async def health_analysis(payload: dict, authorization: Optional[str] = Header(default=None)):
    """Phân tích dữ liệu sức khỏe bằng AI (bản giữ chỗ cho mô hình tương lai).

    Chấp nhận dữ liệu đầu vào tùy ý và trả về kết quả phân tích giữ chỗ.
    Tích hợp mô hình AI đầy đủ đang chờ xử lý.

    Args:
        payload: Dict dữ liệu sức khỏe tùy ý.
        authorization: Token Bearer.

    Returns:
        Phân tích giữ chỗ với risk_level, summary và disclaimer.

    Raises:
        HTTPException 403: Nếu người dùng không phải admin hoặc bác sĩ.
    """
    current_user = await get_user_from_token(authorization)
    if current_user["role"] not in {"admin", "doctor"}:
        raise HTTPException(status_code=403, detail="Chỉ admin hoặc bác sĩ mới có quyền phân tích AI")
    return {
        "risk_level": "medium",
        "summary": "Dữ liệu được nhận. Cần kết nối model AI y khoa để phân tích chuyên sâu.",
        "input_keys": list(payload.keys()),
        "disclaimer": AI_DISCLAIMER,
    }
