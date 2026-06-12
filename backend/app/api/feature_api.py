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
import uuid
from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from app.api.auth_api import get_user_from_token
from app.core.database import database

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
        "modules": ["auth", "patients", "realtime", "alerts", "appointments", "records", "iot", "reports", "ai", "articles"],
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


@router.get("/public/articles")
async def get_public_articles():
    """Lấy danh sách các bài viết y khoa công khai. Tự động seed nếu trống."""
    count = await database.fetch_val("SELECT COUNT(*)::int FROM articles")
    
    if count == 0:
        # Tự động seed một vài bài viết mẫu để giao diện luôn đầy đủ thông tin
        # Lấy một admin hoặc bác sĩ làm tác giả nếu có
        author_row = await database.fetch_one("SELECT id FROM users WHERE role IN ('admin', 'doctor') LIMIT 1")
        author_id = author_row["id"] if author_row else None
        
        sample_articles = [
            {
                "id": str(uuid.uuid4()),
                "title": "Hướng dẫn phòng ngừa đột quỵ và chăm sóc tim mạch tại nhà",
                "slug": "huong-dan-phong-ngua-dot-quy-tai-nha",
                "content": "<p>Đột quỵ là một trong những nguyên nhân hàng đầu gây tử vong và tàn phế trên toàn cầu. Tuy nhiên, hơn 80% trường hợp đột quỵ có thể được phòng ngừa bằng cách kiểm soát tốt các yếu tố nguy cơ.</p><h3>Các biện pháp phòng ngừa quan trọng:</h3><ol><li><strong>Theo dõi nhịp tim và huyết áp thường xuyên:</strong> Sử dụng thiết bị đeo thông minh như CardioGuard AI để phát hiện sớm các dấu hiệu rung nhĩ (Arrhythmia).</li><li><strong>Chế độ dinh dưỡng lành mạnh:</strong> Giảm lượng muối dưới 5g/ngày, tăng cường rau xanh, trái cây và hạn chế chất béo bão hòa.</li><li><strong>Tập thể dục đều đặn:</strong> Dành ít nhất 30 phút mỗi ngày cho các bài tập vừa sức như đi bộ nhanh, bơi lội hoặc đạp xe.</li><li><strong>Tránh các thói quen xấu:</strong> Hạn chế rượu bia, tuyệt đối không hút thuốc lá và hạn chế thức khuya gây căng thẳng tim mạch.</li></ol>",
                "summary": "Đột quỵ có thể phòng ngừa hiệu quả thông qua lối sống lành mạnh và theo dõi các chỉ số sinh tồn của tim thường xuyên bằng công nghệ thông minh.",
                "category": "Y học thường thức",
                "author_id": author_id
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Ứng dụng Trí tuệ Nhân tạo (AI) trong chẩn đoán sớm và cảnh báo suy tim",
                "slug": "ung-dung-ai-trong-canh-bao-suy-tim",
                "content": "<p>Sự ra đời của Trí tuệ Nhân tạo (AI) trong lĩnh vực tim mạch đang mở ra kỷ nguyên mới cho y học cá thể hóa. Bằng cách phân tích hàng triệu điểm dữ liệu từ các thiết bị đo ECG và SpO2 đeo tay, mô hình học máy có thể dự đoán biến cố tim mạch trước nhiều giờ.</p><h3>Tại sao AI hiệu quả hơn phương pháp truyền thống?</h3><ul><li><strong>Giám sát liên tục 24/7:</strong> Thay vì chỉ đo đạc lúc khám tại bệnh viện, AI phân tích dữ liệu nhịp tim liên tục cả khi ngủ và vận động.</li><li><strong>Phát hiện mẫu nhiễu cực nhỏ:</strong> Những bất thường nhỏ của sóng điện tâm đồ (ECG) mà mắt thường khó nhận biết sẽ được AI phát hiện tức thì.</li><li><strong>Cảnh báo khẩn cấp tức thời:</strong> Khi chỉ số vượt ngưỡng nguy hiểm, hệ thống tự động gửi cảnh báo khẩn cấp (SOS) cho bác sĩ điều trị và người thân.</li></ul>",
                "summary": "Tìm hiểu cách hệ thống CardioGuard AI ứng dụng các thuật toán học máy tiên tiến để dự đoán nguy cơ suy tim và gửi cảnh báo khẩn cấp thời gian thực.",
                "category": "Công nghệ Y tế",
                "author_id": author_id
            },
            {
                "id": str(uuid.uuid4()),
                "title": "Tầm quan trọng của chỉ số SpO2 đối với bệnh nhân suy hô hấp và tim mạch",
                "slug": "tam-quan-trong-cua-spo2-tim-mach",
                "content": "<p>SpO2 (độ bão hòa oxy trong máu ngoại vi) là một trong những dấu hiệu sinh tồn cốt lõi của cơ thể. Đối với bệnh nhân suy tim, việc SpO2 sụt giảm đột ngột là hồi chuông cảnh báo nguy hiểm cần can thiệp y tế ngay lập tức.</p><h3>Phân loại chỉ số SpO2 tiêu chuẩn:</h3><ul><li><strong>Từ 97% - 99%:</strong> Chỉ số oxy trong máu tốt, cơ thể bình thường.</li><li><strong>Từ 94% - 96%:</strong> Chỉ số oxy trong máu trung bình, cần chú ý theo dõi.</li><li><strong>Dưới 93%:</strong> Dấu hiệu suy hô hấp, thiếu oxy máu nghiêm trọng, cần hỗ trợ y tế khẩn cấp.</li></ul>",
                "summary": "SpO2 là chỉ số sống còn giúp đánh giá lượng oxy trong máu. Nắm rõ ý nghĩa các ngưỡng chỉ số để bảo vệ sức khỏe hệ hô hấp và tim mạch kịp thời.",
                "category": "Chỉ số Sức khỏe",
                "author_id": author_id
            }
        ]
        
        for art in sample_articles:
            await database.execute(
                """
                INSERT INTO articles (id, title, slug, content, summary, category, author_id, is_active)
                VALUES (:id, :title, :slug, :content, :summary, :category, CAST(:author_id AS uuid), TRUE)
                """,
                {
                    "id": art["id"],
                    "title": art["title"],
                    "slug": art["slug"],
                    "content": art["content"],
                    "summary": art["summary"],
                    "category": art["category"],
                    "author_id": art["author_id"]
                }
            )
            
    rows = await database.fetch_all(
        """
        SELECT 
            a.id,
            a.title,
            a.slug,
            a.content,
            a.summary,
            a.category,
            a.is_active,
            a.created_at,
            a.updated_at,
            u.full_name as author_name
        FROM articles a
        LEFT JOIN users u ON a.author_id::text = u.id::text
        WHERE a.is_active = TRUE
        ORDER BY a.created_at DESC
        """
    )
    
    return [dict(row) for row in rows]

