"""Dịch vụ dọn dẹp dữ liệu định kỳ (Data Cleanup Service).

MỤC ĐÍCH:
    Dọn dẹp tự động các bản ghi OTP hết hạn, mã thông báo JWT bị thu hồi
    và các bản ghi cảnh báo cũ (>90 ngày) để tránh làm phình to cơ sở dữ liệu.
"""

import logging
from app.core.database import database

logger = logging.getLogger(__name__)


async def cleanup_expired_data() -> None:
    """Tiến trình dọn dẹp dữ liệu hết hạn định kỳ."""
    logger.info("Bắt đầu tiến trình dọn dẹp dữ liệu hết hạn...")
    try:
        # 1. Xoá OTP đã hết hạn trên 24 giờ
        deleted_otp = await database.execute(
            """
            DELETE FROM auth_otp_tokens 
            WHERE expires_at < NOW() - INTERVAL '24 hours'
            """
        )
        logger.info("Đã xoá %s mã OTP hết hạn (>24h)", deleted_otp)

        # 2. Xoá tokens bị thu hồi (revoked_tokens) đã hết hạn trên 7 ngày
        deleted_tokens = await database.execute(
            """
            DELETE FROM revoked_tokens 
            WHERE expires_at < NOW() - INTERVAL '7 days'
            """
        )
        logger.info("Đã xoá %s JWT tokens bị thu hồi hết hạn (>7 ngày)", deleted_tokens)

        # 3. Xoá cảnh báo y tế cũ hơn 90 ngày (lưu trữ nếu cần thiết)
        deleted_alerts = await database.execute(
            """
            DELETE FROM alerts 
            WHERE created_at < NOW() - INTERVAL '90 days'
            """
        )
        logger.info("Đã xoá %s cảnh báo cũ (>90 ngày)", deleted_alerts)

    except Exception as e:
        logger.exception("Lỗi xảy ra trong quá trình dọn dẹp dữ liệu định kỳ: %s", e)
