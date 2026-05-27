from datetime import datetime, timezone
from fastapi import APIRouter

router = APIRouter()

AI_DISCLAIMER = "Kết quả AI chỉ mang tính tham khảo, cần bác sĩ xác nhận."


@router.get("/dashboard/summary")
async def dashboard_summary():
    return {
        "status": "running",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "modules": ["auth", "patients", "realtime", "alerts", "appointments", "records", "iot", "reports", "ai"],
        "ai_disclaimer": AI_DISCLAIMER,
    }


@router.post("/ai/health-analysis")
async def health_analysis(payload: dict):
    return {
        "risk_level": "medium",
        "summary": "Dữ liệu được nhận. Cần kết nối model AI y khoa để phân tích chuyên sâu.",
        "input_keys": list(payload.keys()),
        "disclaimer": AI_DISCLAIMER,
    }
