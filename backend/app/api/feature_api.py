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


@router.get("/appointments")
async def appointments():
    return [
        {"id": "apt-001", "title": "Khám tim mạch định kỳ", "status": "confirmed", "channel": "clinic"},
        {"id": "apt-002", "title": "Tư vấn trực tuyến", "status": "pending", "channel": "video"},
    ]


@router.get("/medical-records")
async def medical_records():
    return [
        {"id": "rec-001", "type": "diagnosis", "summary": "Theo dõi tăng huyết áp", "files": []},
        {"id": "rec-002", "type": "lab", "summary": "Chờ kết nối lưu trữ PDF/X-ray", "files": []},
    ]


@router.get("/iot-devices")
async def iot_devices():
    return [
        {"id": "dev-001", "name": "Wearable CG-01", "status": "online", "battery": 82},
        {"id": "dev-002", "name": "ECG Gateway ICU", "status": "degraded", "battery": None},
    ]


@router.get("/reports/summary")
async def reports_summary():
    return {
        "uptime": "mocked",
        "server": {"cpu": "N/A", "ram": "N/A", "database": "configured"},
        "export_pdf": "pending_real_implementation",
    }


@router.post("/ai/health-analysis")
async def health_analysis(payload: dict):
    return {
        "risk_level": "medium",
        "summary": "Dữ liệu được nhận. Cần kết nối model AI y khoa để phân tích chuyên sâu.",
        "input_keys": list(payload.keys()),
        "disclaimer": AI_DISCLAIMER,
    }
