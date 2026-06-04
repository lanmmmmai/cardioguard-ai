"""Giới hạn tốc độ trong bộ nhớ cho các điểm cuối xác thực.

MỤC ĐÍCH:
    Bảo vệ các điểm cuối xác thực (đăng nhập, OTP) khỏi tấn công brute-force
    bằng cách giới hạn yêu cầu theo tổ hợp IP/email/điểm cuối trong
    một cửa sổ thời gian trượt.

LUỒNG XỬ LÝ:
    1. Trích xuất địa chỉ IP thực của máy khách từ header proxy (X-Forwarded-For).
    2. Lưu trữ dấu thời gian yêu cầu theo khóa (ip, email, endpoint).
    3. Mỗi yêu cầu, loại bỏ dấu thời gian hết hạn và kiểm tra số lượng.
    4. Ném HTTP 429 nếu vượt quá giới hạn kèm thông báo thử lại sau.

QUAN HỆ:
    - Được sử dụng bởi: auth_api (các điểm cuối đăng nhập, xác thực OTP, quên mật khẩu)
    - Dữ liệu: từ điển trong bộ nhớ (mất khi khởi động lại máy chủ)
"""

from collections import OrderedDict
import logging
import time
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

# Bộ nhớ lưu trữ giới hạn tốc độ: { (ip, email, endpoint): [danh_sách_dấu_thời_gian] }
_rate_limits: "OrderedDict[tuple[str, str, str], list[float]]" = OrderedDict()
_RATE_LIMIT_STORE_MAX_KEYS = 2048
_RATE_LIMIT_RETENTION_SECONDS = 300


def _prune_rate_limits(now: float) -> None:
    """Dọn các key đã hết hạn và chặn tăng trưởng bộ nhớ vô hạn."""
    expired_keys = [
        key
        for key, timestamps in list(_rate_limits.items())
        if not [ts for ts in timestamps if now - ts < _RATE_LIMIT_RETENTION_SECONDS]
    ]
    for key in expired_keys:
        _rate_limits.pop(key, None)

    while len(_rate_limits) > _RATE_LIMIT_STORE_MAX_KEYS:
        _rate_limits.popitem(last=False)

def get_client_ip(request: Request) -> str:
    """Trích xuất địa chỉ IP thực của máy khách từ các header yêu cầu.

    Tôn trọng header X-Forwarded-For và X-Real-IP cho thiết lập reverse proxy.

    Tham số:
        request: Yêu cầu đến FastAPI.

    Trả về:
        Chuỗi địa chỉ IP của máy khách, hoặc "unknown" nếu không có.
    """
    x_forwarded_for = request.headers.get("X-Forwarded-For")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        return x_real_ip.strip()
    return request.client.host if request.client else "unknown"

def check_rate_limit(ip: str, email: str, endpoint: str, max_requests: int = 5, window_seconds: int = 60):
    """Kiểm tra và thực thi giới hạn tốc độ cho một máy khách + hành động cụ thể.

    Thuật toán cửa sổ trượt: loại bỏ các dấu thời gian cũ hơn window_seconds,
    sau đó từ chối nếu số lượng còn lại đạt hoặc vượt quá max_requests.

    Tham số:
        ip: Địa chỉ IP của máy khách.
        email: Email người dùng đã chuẩn hóa.
        endpoint: Định danh điểm cuối API (ví dụ "/auth/login").
        max_requests: Số yêu cầu tối đa cho phép trong cửa sổ.
        window_seconds: Thời lượng cửa sổ trượt tính bằng giây.

    Ngoại lệ:
        HTTPException: 429 Too Many Requests kèm thông báo thử lại sau.
    """
    now = time.time()
    key = (ip, email.lower().strip(), endpoint)

    # Lấy danh sách dấu thời gian hiện tại hoặc khởi tạo danh sách rỗng
    timestamps = _rate_limits.get(key, [])
    # Chỉ giữ lại các dấu thời gian còn trong cửa sổ
    timestamps = [t for t in timestamps if now - t < window_seconds]

    # Nếu số lượng yêu cầu đã đạt giới hạn, ném lỗi 429
    if len(timestamps) >= max_requests:
        wait_time = int(window_seconds - (now - timestamps[0]))
        logger.warning("Vượt quá giới hạn tốc độ: ip=%s email=%s endpoint=%s chờ=%ds", ip, email, endpoint, wait_time)
        raise HTTPException(
            status_code=429,
            detail=f"Quá nhiều yêu cầu gửi tới {endpoint}. Vui lòng thử lại sau {wait_time} giây."
        )

    # Thêm dấu thời gian hiện tại vào danh sách
    timestamps.append(now)
    _rate_limits[key] = timestamps
    _rate_limits.move_to_end(key)
    _prune_rate_limits(now)
    logger.debug("check_rate_limit: allowed, ip=%s email=%s endpoint=%s count=%d/%d window=%ds", ip, email, endpoint, len(timestamps), max_requests, window_seconds)

