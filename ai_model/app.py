"""
CardioGuard AI - API dự đoán nguy cơ bệnh tim

Mục đích:
    Máy chủ FastAPI cung cấp điểm cuối REST để dự đoán nguy cơ bệnh tim
    sử dụng mô hình RandomForest đã được huấn luyện trước.

Luồng xử lý:
    1. Tải mô hình đã huấn luyện (heart_disease_model.pkl) và siêu dữ liệu khi khởi động.
    2. Kiểm tra tính tương thích phiên bản scikit-learn giữa lúc huấn luyện và lúc phục vụ.
    3. Cung cấp điểm cuối POST /predict-heart-risk nhận 13 đặc trưng sức khỏe
       và trả về kết quả dự đoán (0/1), xác suất, và mức độ nguy cơ.
    4. Bao gồm cơ chế giới hạn tần suất trong bộ nhớ (10 yêu cầu/phút/IP) để ngăn chặn lạm dụng.
    5. Cung cấp điểm cuối GET / và GET /health để kiểm tra trạng thái dịch vụ.

Mối quan hệ:
    - ai_model/train_model.py: Tạo ra file mô hình .pkl và siêu dữ liệu được tiêu thụ ở đây.
    - Frontend (React/Vite): Gửi yêu cầu POST với dữ liệu sức khỏe; hiển thị kết quả dự đoán.
    - MongoDB: Không liên kết trực tiếp, nhưng frontend lưu trữ lịch sử dự đoán.
"""

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

# Cho phép frontend gọi API thông qua CORS
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
# Bộ giới hạn tần suất (Rate Limiter) trong bộ nhớ
# -----------------------------------------------------------
import time
from collections import defaultdict
from fastapi import Request

_rate_limits = defaultdict(list)

def check_rate_limit(ip: str, endpoint: str, max_requests: int = 10, window_seconds: int = 60):
    """
    Áp dụng giới hạn tần suất cho từng địa chỉ IP sử dụng bộ lưu trữ dấu thời gian
    dạng cửa sổ trượt trong bộ nhớ.

    Tham số:
        ip: Địa chỉ IP của máy khách cần theo dõi.
        endpoint: Đường dẫn điểm cuối API để giới hạn phạm vi.
        max_requests: Số lượng yêu cầu tối đa được phép trong cửa sổ (mặc định 10).
        window_seconds: Thời gian cửa sổ tính bằng giây (mặc định 60).

    Ngoại lệ:
        HTTPException 429: Nếu máy khách đã gửi nhiều hơn max_requests trong cửa sổ.
    """
    now = time.time()
    key = (ip, endpoint)

    # Lấy danh sách dấu thời gian yêu cầu hiện có cho tổ hợp IP và điểm cuối này
    timestamps = _rate_limits[key]
    # Loại bỏ các dấu thời gian nằm ngoài cửa sổ trượt hiện tại
    timestamps = [t for t in timestamps if now - t < window_seconds]

    if len(timestamps) >= max_requests:
        # Tính thời gian chờ còn lại trước khi yêu cầu sớm nhất hết hạn
        wait_time = int(window_seconds - (now - timestamps[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Quá nhiều yêu cầu gửi tới {endpoint}. Vui lòng thử lại sau {wait_time} giây."
        )
    # Ghi lại dấu thời gian của yêu cầu hiện tại và lưu trở lại
    timestamps.append(now)
    _rate_limits[key] = timestamps

# -----------------------------------------------------------
# Tải mô hình khi máy chủ khởi động
# -----------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "heart_disease_model.pkl")

# Kiểm tra xem file mô hình có tồn tại hay không
if not os.path.exists(MODEL_PATH):
    raise RuntimeError(
        f"Không tìm thấy file mô hình tại '{MODEL_PATH}'. "
        "Vui lòng chạy 'python train_model.py' trước để huấn luyện mô hình."
    )

# Nạp mô hình vào bộ nhớ một lần duy nhất khi máy chủ khởi động
model = joblib.load(MODEL_PATH)
print(f"✅ Model đã được nạp thành công từ: {MODEL_PATH}")

# Kiểm tra tính tương thích phiên bản scikit-learn
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

# Thứ tự các cột đầu vào phải khớp với thứ tự lúc huấn luyện
FEATURE_COLUMNS = [
    "age", "sex", "cp", "trestbps", "chol",
    "fbs", "restecg", "thalach", "exang",
    "oldpeak", "slope", "ca", "thal"
]


# -----------------------------------------------------------
# Lược đồ dữ liệu đầu vào (Mô hình Pydantic)
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
        # Ví dụ mẫu hiển thị trong tài liệu /docs
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
# Lược đồ dữ liệu đầu ra (Phản hồi)
# -----------------------------------------------------------
class HeartRiskOutput(BaseModel):
    """Kết quả dự đoán nguy cơ bệnh tim."""
    prediction: int = Field(..., description="0=Không có nguy cơ, 1=Có nguy cơ")
    risk_probability: float = Field(..., description="Xác suất có nguy cơ bệnh tim (0.0 - 1.0)")
    risk_level: str = Field(..., description="Mức độ nguy cơ: Thấp / Trung bình / Cao")
    message: str = Field(..., description="Lưu ý về kết quả dự đoán")


# -----------------------------------------------------------
# Hàm phân loại mức độ nguy cơ dựa trên xác suất
# -----------------------------------------------------------
def classify_risk_level(probability: float) -> str:
    """
    Phân loại mức độ nguy cơ dựa trên ngưỡng xác suất dự đoán.

    Tham số:
        probability: Xác suất nguy cơ từ 0.0 đến 1.0.

    Kết quả trả về:
        "Thấp" nếu probability < 0.30,
        "Trung bình" nếu 0.30 <= probability < 0.65,
        "Cao" nếu probability >= 0.65.
    """
    if probability < 0.30:
        return "Thấp"
    elif probability < 0.65:
        return "Trung bình"
    else:
        return "Cao"


# -----------------------------------------------------------
# Điểm cuối chính: Dự đoán nguy cơ bệnh tim
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

    Bị giới hạn tần suất 10 yêu cầu/phút/IP. Kết quả chỉ mang tính tham khảo
    và không thay thế chẩn đoán y tế chuyên nghiệp.

    Tham số:
        data: Các chỉ số sức khỏe đã được xác thực (13 đặc trưng) thông qua lược đồ HeartRiskInput.
        request: Đối tượng Yêu cầu FastAPI để trích xuất địa chỉ IP của máy khách.

    Kết quả trả về:
        HeartRiskOutput với prediction (0/1), risk_probability, risk_level, và tuyên bố miễn trừ y tế.

    Ngoại lệ:
        HTTPException 429: Vượt quá giới hạn tần suất.
        HTTPException 500: Lỗi nội bộ trong quá trình suy luận mô hình.
    """
    ip = request.client.host if request.client else "unknown"
    check_rate_limit(ip, "/predict-heart-risk", max_requests=10, window_seconds=60)
    try:
        # Chuyển đổi dữ liệu đầu vào thành mảng numpy theo đúng thứ tự cột
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

        # Lấy xác suất dự đoán cho từng nhãn
        # predict_proba trả về [[xác_suất_nhãn_0, xác_suất_nhãn_1]]
        probabilities = model.predict_proba(input_data)[0]
        risk_probability = float(round(probabilities[1], 4))  # Xác suất có nguy cơ

        # Phân loại mức độ nguy cơ dựa trên xác suất
        risk_level = classify_risk_level(risk_probability)

        return HeartRiskOutput(
            prediction=prediction,
            risk_probability=risk_probability,
            risk_level=risk_level,
            message="Kết quả chỉ mang tính tham khảo, không thay thế chẩn đoán của bác sĩ."
        )

    except Exception as exc:
        # Ghi nhật ký lỗi và trả về lỗi 500 nếu có sự cố trong quá trình dự đoán
        logger.exception("Error during model prediction")
        raise HTTPException(
            status_code=500,
            detail="Lỗi khi thực hiện dự đoán. Vui lòng kiểm tra lại dữ liệu đầu vào."
        ) from exc


# -----------------------------------------------------------
# Điểm cuối kiểm tra trạng thái máy chủ
# -----------------------------------------------------------
@app.get("/", summary="Kiểm tra server", tags=["Health Check"])
async def root():
    """
    Điểm cuối kiểm tra sức khỏe trả về siêu dữ liệu dịch vụ cơ bản.

    Kết quả trả về:
        dict: Tên dịch vụ, trạng thái, phiên bản, điểm cuối khả dụng, và URL tài liệu.
    """
    return {
        "service": "CardioGuard AI - Heart Risk Prediction",
        "status": "running",
        "version": "1.0.0",
        "endpoint": "POST /predict-heart-risk",
        "docs": "/docs"
    }


@app.get("/health", summary="Health check", tags=["Health Check"])
async def health_check():
    """
    Kiểm tra sức khỏe chi tiết xác nhận trạng thái tải mô hình.

    Kết quả trả về:
        dict: Trạng thái, cờ model_loaded, tên file mô hình, và danh sách cột đặc trưng.
    """
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model_name": os.path.basename(MODEL_PATH),
        "features": FEATURE_COLUMNS
    }
