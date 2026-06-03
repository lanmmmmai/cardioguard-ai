"""Tiện ích bảo mật: băm mật khẩu và tạo token JWT.

MỤC ĐÍCH:
    Cung cấp các nguyên hàm mật mã cho xác thực:
    - Băm và xác minh mật khẩu bằng bcrypt
    - Tạo token JWT truy cập với chữ ký HS256

LUỒNG XỬ LÝ:
    1. hash_password / verify_password xử lý lưu trữ mật khẩu an toàn.
    2. create_access_token tạo JWT đã ký với thời hạn và ID duy nhất.

QUAN HỆ:
    - Khóa/thuật toán lấy từ: app.core.config.settings
    - Được sử dụng bởi: auth_api (đăng nhập/đăng ký), websocket/auth endpoints
"""

import logging
from datetime import datetime, timedelta, timezone
from jose import jwt
import uuid
import bcrypt
from app.core.config import settings

logger = logging.getLogger(__name__)

# Khóa bí mật và cấu hình thuật toán cho JWT
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


def hash_password(password: str) -> str:
    """Băm mật khẩu dạng văn bản thuần túy bằng bcrypt.

    Tham số:
        password: Chuỗi mật khẩu văn bản thuần túy.

    Trả về:
        Chuỗi mật khẩu đã băm bcrypt (bao gồm muối nhúng).
    """
    logger.debug("hash_password: entry, password_length=%d", len(password))
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    result = hashed.decode("utf-8")
    logger.debug("hash_password: exit, hash_length=%d", len(result))
    return result


def verify_password(password: str, hashed_password: str) -> bool:
    """Xác minh mật khẩu văn bản thuần túy so với băm bcrypt.

    Tham số:
        password: Mật khẩu văn bản thuần túy cần kiểm tra.
        hashed_password: Băm bcrypt đã lưu để so sánh.

    Trả về:
        True nếu mật khẩu khớp với băm, False nếu không.
    """
    try:
        password_bytes = password.encode("utf-8")
        hashed_bytes = hashed_password.encode("utf-8")
        result = bcrypt.checkpw(password_bytes, hashed_bytes)
        logger.debug("verify_password: result=%s", result)
        return result
    except Exception as e:
        logger.exception("Lỗi khi xác minh mật khẩu")
        return False


def create_access_token(data: dict) -> str:
    """Tạo token JWT truy cập đã ký.

    Tham số:
        data: Các claim cần đưa vào tải trọng token (ví dụ {"sub": user_id}).

    Trả về:
        Chuỗi JWT đã mã hóa ký bằng HS256.
    """
    logger.debug("create_access_token: entry, data_keys=%s", list(data.keys()))
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "jti": str(uuid.uuid4())
    })
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug("create_access_token: exit, token_length=%d", len(token))
    return token
