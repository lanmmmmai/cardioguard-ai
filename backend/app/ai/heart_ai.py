"""Phát hiện bất thường dựa trên quy tắc cho dữ liệu cảm biến tim mạch thời gian thực.

Mục đích:
  Đánh giá các chỉ số dấu hiệu sinh tồn đến so với các ngưỡng lâm sàng và
  tạo ra một danh sách các cảnh báo khi các giá trị nằm ngoài phạm vi an toàn.

Luồng công việc:
  1. Chấp nhận một đối tượng dữ liệu cảm biến (nhịp tim, SpO2, huyết áp, ECG).
  2. Mỗi tham số được so sánh với các ngưỡng được mã hóa cứng; nếu vượt quá, một
     dict cảnh báo được thêm vào với loại, tin nhắn tiếng Việt và mức độ nghiêm trọng.
  3. Trả về danh sách các cảnh báo (có thể rỗng).

Quan hệ:
  - Được gọi bởi đường ống tiếp nhận cảm biến thời gian thực (ví dụ: WebSocket hoặc
    API cảm biến REST) trước khi lưu trữ dữ liệu hoặc phát sóng cảnh báo.
"""

def detect_abnormal(data):
    """So sánh các chỉ số cảm biến với ngưỡng lâm sàng và trả về các cảnh báo.

    Args:
        data: Một đối tượng dữ liệu cảm biến (hoặc bất kỳ đối tượng nào có các thuộc tính
              ``heart_rate``, ``spo2``, ``systolic_bp``, ``diastolic_bp``,
              ``ecg_value``).

    Trả về:
        list[dict]: Một danh sách các dictionary cảnh báo, mỗi dict chứa
        ``alert_type``, ``message`` (Tiếng Việt) và ``severity``
        (``"high"`` hoặc ``"medium"``). Rỗng khi tất cả các giá trị đều bình thường.
    """
    alerts = []

    # Ngưỡng nhịp nhanh: > 120 bpm
    if data.heart_rate > 120:
        alerts.append({
            "alert_type": "HIGH_HEART_RATE",
            "message": "Nhịp tim quá cao",
            "severity": "high"
        })

    # Ngưỡng nhịp chậm: < 50 bpm
    if data.heart_rate < 50:
        alerts.append({
            "alert_type": "LOW_HEART_RATE",
            "message": "Nhịp tim quá thấp",
            "severity": "high"
        })

    # Ngưỡng thiếu oxy máu: SpO2 < 92 %
    if data.spo2 < 92:
        alerts.append({
            "alert_type": "LOW_SPO2",
            "message": "Nồng độ SpO2 thấp",
            "severity": "high"
        })

    # Ngưỡng tăng huyết áp: tâm thu > 140 hoặc tâm trương > 90 mmHg
    if data.systolic_bp > 140 or data.diastolic_bp > 90:
        alerts.append({
            "alert_type": "HIGH_BLOOD_PRESSURE",
            "message": "Huyết áp cao",
            "severity": "medium"
        })

    # Ngưỡng biên độ ECG: giá trị tuyệt đối mV > 0.8
    if data.ecg_value > 0.8 or data.ecg_value < -0.8:
        alerts.append({
            "alert_type": "ABNORMAL_ECG",
            "message": "Tín hiệu ECG bất thường",
            "severity": "high"
        })

    return alerts
