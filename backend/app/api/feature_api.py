from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app.api.auth_api import get_user_from_token

router = APIRouter()

AI_DISCLAIMER = "Kết quả AI chỉ mang tính tham khảo, cần bác sĩ xác nhận."


@router.get("/dashboard/summary")
async def dashboard_summary(authorization: Optional[str] = Header(default=None)):
    await get_user_from_token(authorization)
    return {
        "status": "running",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "modules": ["auth", "patients", "realtime", "alerts", "appointments", "records", "iot", "reports", "ai"],
        "ai_disclaimer": AI_DISCLAIMER,
    }


@router.post("/ai/health-analysis")
async def health_analysis(payload: dict, authorization: Optional[str] = Header(default=None)):
    current_user = await get_user_from_token(authorization)
    if current_user["role"] not in {"admin", "doctor"}:
        raise HTTPException(status_code=403, detail="Chỉ admin hoặc bác sĩ mới có quyền phân tích AI")
    return {
        "risk_level": "medium",
        "summary": "Dữ liệu được nhận. Cần kết nối model AI y khoa để phân tích chuyên sâu.",
        "input_keys": list(payload.keys()),
        "disclaimer": AI_DISCLAIMER,
    }
