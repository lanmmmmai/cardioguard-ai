# =============================================================================
# CardioGuard AI - API Dự Đoán Nguy Cơ Bệnh Tim
# File: app.py
# Mô tả: FastAPI server cung cấp endpoint dự đoán nguy cơ bệnh tim
#        dựa trên model RandomForest đã được huấn luyện.
#
# Hướng dẫn chạy trên macOS (Terminal):
#   1. Cài thư viện (nếu chưa có):
#      pip install fastapi uvicorn joblib scikit-learn
#
#   2. Chạy server:
#      cd /path/to/cardioguard-ai/ai_model
#      uvicorn app:app --reload --port 8001
#
#   3. Truy cập tài liệu API tự động:
#      http://localhost:8001/docs
# =============================================================================

import os
import joblib
import logging

logger = logging.getLogger(__name__)
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# -----------------------------------------------------------
# Khởi tạo ứng dụng FastAPI
# -----------------------------------------------------------
app = FastAPI(
    title="CardioGuard AI - Heart Risk Prediction API",
    description=(
        "API dự đoán nguy cơ bệnh tim dựa trên các chỉ số sức khỏe. "
        "Kết quả chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ."
    ),
    version="1.0.0",
)

# Cho phép frontend gọi API (CORS)
allowed_origins_raw = os.getenv(
    "AI_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,https://cardioguard-ai.vercel.app",
)
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# -----------------------------------------------------------
# Bộ giới hạn tần suất (Rate Limiter) bộ nhớ trong
# -----------------------------------------------------------
import time
from collections import defaultdict
from fastapi import Request

_rate_limits = defaultdict(list)

def check_rate_limit(ip: str, endpoint: str, max_requests: int = 10, window_seconds: int = 60):
    now = time.time()
    key = (ip, endpoint)
    
    timestamps = _rate_limits[key]
    timestamps = [t for t in timestamps if now - t < window_seconds]
    
    if len(timestamps) >= max_requests:
        wait_time = int(window_seconds - (now - timestamps[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Quá nhiều yêu cầu gửi tới {endpoint}. Vui lòng thử lại sau {wait_time} giây."
        )
    timestamps.append(now)
    _rate_limits[key] = timestamps

# -----------------------------------------------------------
# Load model khi server khởi động
# -----------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "heart_disease_model.pkl")

# Kiểm tra file model có tồn tại không
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(
        f"Không tìm thấy file model tại '{MODEL_PATH}'. "
        "Vui lòng chạy 'python train_model.py' trước để huấn luyện model."
    )

# Nạp model vào bộ nhớ một lần duy nhất khi server khởi động
model = joblib.load(MODEL_PATH)
print(f"✅ Model đã được nạp thành công từ: {MODEL_PATH}")

# Kiểm tra phiên bản scikit-learn
METADATA_PATH = os.path.join(BASE_DIR, "model_metadata.json")
if os.path.exists(METADATA_PATH):
    import json
    import sklearn
    try:
        with open(METADATA_PATH, "r", encoding="utf-8") as f:
            metadata = json.load(f)
        train_version = metadata.get("scikit_learn_version")
        current_version = sklearn.__version__
        if train_version != current_version:
            logger.warning(
                f"⚠️ CẢNH BÁO: Phiên bản scikit-learn lúc huấn luyện ({train_version}) "
                f"khác phiên bản hiện tại ({current_version}). Mô hình có thể dự đoán không chính xác."
            )
    except Exception as err:
        logger.error(f"Không thể đọc model metadata: {err}")

# Thứ tự cột đầu vào phải khớp với lúc huấn luyện
FEATURE_COLUMNS = [
    "age", "sex", "cp", "trestbps", "chol",
    "fbs", "restecg", "thalach", "exang",
    "oldpeak", "slope", "ca", "thal"
]


# -----------------------------------------------------------
# Schema dữ liệu đầu vào (Pydantic Model)
# -----------------------------------------------------------
class HeartRiskInput(BaseModel):
    """Dữ liệu sức khỏe đầu vào để dự đoán nguy cơ bệnh tim."""

    age: float = Field(..., ge=1, le=120, description="Tuổi (ví dụ: 55)")
    sex: float = Field(..., ge=0, le=1, description="Giới tính: 1=Nam, 0=Nữ")
    cp: float = Field(..., ge=1, le=4, description="Loại đau ngực: 1=Đau thắt điển hình, 2=Không điển hình, 3=Không đau ngực, 4=Không triệu chứng")
    trestbps: float = Field(..., ge=80, le=250, description="Huyết áp tâm thu lúc nghỉ (mmHg, ví dụ: 130)")
    chol: float = Field(..., ge=100, le=600, description="Cholesterol huyết thanh (mg/dl, ví dụ: 250)")
    fbs: float = Field(..., ge=0, le=1, description="Đường huyết đói > 120 mg/dl: 1=Có, 0=Không")
    restecg: float = Field(..., ge=0, le=2, description="Kết quả ECG lúc nghỉ: 0=Bình thường, 1=Bất thường ST-T, 2=Phì đại thất trái")
    thalach: float = Field(..., ge=60, le=250, description="Nhịp tim tối đa đạt được (ví dụ: 150)")
    exang: float = Field(..., ge=0, le=1, description="Đau thắt ngực khi gắng sức: 1=Có, 0=Không")
    oldpeak: float = Field(..., ge=0.0, le=10.0, description="ST depression so với lúc nghỉ (ví dụ: 1.5)")
    slope: float = Field(..., ge=1, le=3, description="Độ dốc đoạn ST: 1=Đi lên, 2=Phẳng, 3=Đi xuống")
    ca: float = Field(..., ge=0, le=3, description="Số mạch máu lớn (0-3) phát hiện qua fluoroscopy")
    thal: float = Field(..., ge=3, le=7, description="Kết quả thalassemia: 3=Bình thường, 6=Khiếm khuyết cố định, 7=Có thể hồi phục")

    class Config:
        # Ví dụ mẫu hiển thị trong /docs
        json_schema_extra = {
            "example": {
                "age": 55,
                "sex": 1,
                "cp": 3,
                "trestbps": 130,
                "chol": 250,
                "fbs": 0,
                "restecg": 0,
                "thalach": 150,
                "exang": 0,
                "oldpeak": 1.5,
                "slope": 2,
                "ca": 1,
                "thal": 3
            }
        }


# -----------------------------------------------------------
# Schema dữ liệu đầu ra (Response)
# -----------------------------------------------------------
class HeartRiskOutput(BaseModel):
    """Kết quả dự đoán nguy cơ bệnh tim."""
    prediction: int = Field(..., description="0=Không có nguy cơ, 1=Có nguy cơ")
    risk_probability: float = Field(..., description="Xác suất có nguy cơ bệnh tim (0.0 - 1.0)")
    risk_level: str = Field(..., description="Mức độ nguy cơ: Thấp / Trung bình / Cao")
    message: str = Field(..., description="Lưu ý về kết quả dự đoán")


# -----------------------------------------------------------
# Hàm phân loại mức độ nguy cơ theo xác suất
# -----------------------------------------------------------
def classify_risk_level(probability: float) -> str:
    """
    Phân loại mức độ nguy cơ dựa trên xác suất dự đoán.
    - Thấp    : xác suất < 30%
    - Trung bình: 30% <= xác suất < 65%
    - Cao     : xác suất >= 65%
    """
    if probability < 0.30:
        return "Thấp"
    elif probability < 0.65:
        return "Trung bình"
    else:
        return "Cao"


# -----------------------------------------------------------
# Endpoint chính: Dự đoán nguy cơ bệnh tim
# -----------------------------------------------------------
@app.post(
    "/predict-heart-risk",
    response_model=HeartRiskOutput,
    summary="Dự đoán nguy cơ bệnh tim",
    tags=["Dự đoán"]
)
def predict_heart_risk(data: HeartRiskInput, request: Request):
    """
    Nhận các chỉ số sức khỏe và trả về kết quả dự đoán nguy cơ bệnh tim.

    **Lưu ý:** Kết quả chỉ mang tính tham khảo hỗ trợ bác sĩ,
    không thay thế chẩn đoán y khoa chính thức.
    """
    ip = request.client.host if request.client else "unknown"
    check_rate_limit(ip, "/predict-heart-risk", max_requests=10, window_seconds=60)
    try:
        # Chuyển dữ liệu đầu vào thành mảng numpy theo đúng thứ tự cột
        input_data = np.array([[
            data.age,
            data.sex,
            data.cp,
            data.trestbps,
            data.chol,
            data.fbs,
            data.restecg,
            data.thalach,
            data.exang,
            data.oldpeak,
            data.slope,
            data.ca,
            data.thal
        ]])

        # Dự đoán nhãn (0 hoặc 1)
        prediction = int(model.predict(input_data)[0])

        # Lấy xác suất dự đoán của từng nhãn
        # predict_proba trả về [[prob_class_0, prob_class_1]]
        probabilities = model.predict_proba(input_data)[0]
        risk_probability = float(round(probabilities[1], 4))  # Xác suất có nguy cơ

        # Phân loại mức độ nguy cơ
        risk_level = classify_risk_level(risk_probability)

        return HeartRiskOutput(
            prediction=prediction,
            risk_probability=risk_probability,
            risk_level=risk_level,
            message="Kết quả chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ."
        )

    except Exception as exc:
        # Trả về lỗi 500 nếu có sự cố trong quá trình dự đoán
        logger.exception("Error during model prediction")
        raise HTTPException(
            status_code=500,
            detail="Lỗi khi thực hiện dự đoán. Vui lòng kiểm tra lại dữ liệu đầu vào."
        ) from exc


# -----------------------------------------------------------
# Endpoint kiểm tra trạng thái server
# -----------------------------------------------------------
@app.get("/", summary="Kiểm tra server", tags=["Health Check"])
async def root():
    """Kiểm tra server AI đang hoạt động."""
    return {
        "service": "CardioGuard AI - Heart Risk Prediction",
        "status": "running",
        "version": "1.0.0",
        "endpoint": "POST /predict-heart-risk",
        "docs": "/docs"
    }


@app.get("/health", summary="Health check", tags=["Health Check"])
async def health_check():
    """Kiểm tra trạng thái model đã được nạp chưa."""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_name": os.path.basename(MODEL_PATH),
        "features": FEATURE_COLUMNS
    }
