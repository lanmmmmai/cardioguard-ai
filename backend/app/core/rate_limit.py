import time
from fastapi import HTTPException

# In-memory storage for rate limits: { (ip, email, endpoint): [timestamps] }
_rate_limits = {}

def check_rate_limit(ip: str, email: str, endpoint: str, max_requests: int = 5, window_seconds: int = 60):
    now = time.time()
    key = (ip, email.lower().strip(), endpoint)
    
    # Lấy danh sách các mốc thời gian còn trong cửa sổ giám sát
    timestamps = _rate_limits.get(key, [])
    timestamps = [t for t in timestamps if now - t < window_seconds]
    
    if len(timestamps) >= max_requests:
        wait_time = int(window_seconds - (now - timestamps[0]))
        raise HTTPException(
            status_code=429,
            detail=f"Quá nhiều yêu cầu gửi tới {endpoint}. Vui lòng thử lại sau {wait_time} giây."
        )
        
    timestamps.append(now)
    _rate_limits[key] = timestamps
