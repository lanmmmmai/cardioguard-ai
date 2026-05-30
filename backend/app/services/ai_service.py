import asyncio
import json
from typing import Any, Dict, List
from app.core.config import settings

try:
    from openai import AsyncOpenAI
    if hasattr(settings, "OPENAI_API_KEY") and settings.OPENAI_API_KEY:
        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        HAS_OPENAI = True
    else:
        client = None
        HAS_OPENAI = False
except ImportError:
    client = None
    HAS_OPENAI = False

PATIENT_SYSTEM_PROMPT = """Bạn là trợ lý sức khỏe CardioGuard AI - một chuyên gia y tế AI thân thiện, tận tâm và dễ hiểu.
Mục tiêu của bạn là giúp bệnh nhân hiểu về các chỉ số sức khỏe, lịch sử bệnh án và các cảnh báo của họ.

QUY TẮC QUAN TRỌNG:
1. LUÔN trả lời bằng tiếng Việt, thân thiện, đồng cảm và dễ hiểu.
2. KHÔNG đưa ra chẩn đoán y khoa chính thức. Luôn thêm câu "CardioGuard AI chỉ hỗ trợ tham khảo và không thay thế bác sĩ chuyên môn." ở cuối câu trả lời nếu liên quan đến lời khuyên y tế.
3. Nếu các chỉ số sức khỏe của bệnh nhân (như SpO2 < 90, Nhịp tim > 120 hoặc < 50) ở mức nguy hiểm, HÃY KHUYÊN HỌ LIÊN HỆ BÁC SĨ HOẶC CẤP CỨU NGAY LẬP TỨC.
4. Trả lời ngắn gọn, format bằng Markdown (dùng bullet points, in đậm chữ quan trọng).
"""

DOCTOR_SYSTEM_PROMPT = """Bạn là AI Assistant hỗ trợ bác sĩ chuyên khoa tim mạch trên hệ thống CardioGuard AI.
Mục tiêu của bạn là phân tích dữ liệu bệnh nhân (chỉ số sensor, cảnh báo, lịch sử bệnh án) để giúp bác sĩ có cái nhìn tổng quan nhanh chóng và chính xác.

QUY TẮC QUAN TRỌNG:
1. LUÔN trả lời bằng tiếng Việt, văn phong chuyên nghiệp, y khoa, súc tích.
2. KHÔNG tạo ra dữ liệu giả. Chỉ dựa vào dữ liệu context được cung cấp.
3. Nếu được yêu cầu tóm tắt, hãy làm nổi bật các chỉ số bất thường (nhịp tim, huyết áp, SpO2) và các cảnh báo gần đây.
4. Format bằng Markdown gọn gàng.
"""

class AIService:
    @staticmethod
    async def generate_chat_response(role: str, user_message: str, context_data: Dict[str, Any] = None, chat_history: List[Dict[str, str]] = None) -> str:
        """
        Generate response using OpenAI. If API key is not configured, return a mocked rule-based response.
        """
        system_prompt = PATIENT_SYSTEM_PROMPT if role == "patient" else DOCTOR_SYSTEM_PROMPT
        
        # Build context
        context_str = ""
        if context_data:
            context_str = f"\\n\\n[DỮ LIỆU NGỮ CẢNH CỦA BỆNH NHÂN ĐỂ BẠN THAM KHẢO]:\\n{json.dumps(context_data, ensure_ascii=False, indent=2)}\\n"

        # Mock response if no API key or library missing
        if not HAS_OPENAI or not client:
            return AIService._mock_response(role, user_message, context_data)

        try:
            # Format history for OpenAI
            # OpenAI history format: [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
            messages = [
                {"role": "system", "content": f"{system_prompt}{context_str}"}
            ]
            
            if chat_history:
                for msg in chat_history:
                    role_mapping = "user" if msg["sender"] == "user" else "assistant"
                    messages.append({
                        "role": role_mapping,
                        "content": msg["message"]
                    })
                    
            messages.append({"role": "user", "content": user_message})
            
            response = await client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.7,
                max_tokens=800
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"AI Error: {e}")
            return f"Xin lỗi, hệ thống AI đang bận hoặc gặp sự cố ({str(e)}). Vui lòng thử lại sau."

    @staticmethod
    def _mock_response(role: str, message: str, context_data: Dict[str, Any]) -> str:
        """Fallback mock responses for testing without API keys."""
        msg_lower = message.lower()
        
        if role == "patient":
            if "nhịp tim" in msg_lower:
                return "Nhịp tim (Heart Rate) là số lần tim đập trong một phút. Nhịp tim bình thường lúc nghỉ ngơi thường từ 60 đến 100 nhịp/phút. Dữ liệu của bạn cho thấy nhịp tim hiện tại đang ở mức ổn định.\\n\\n*CardioGuard AI chỉ hỗ trợ tham khảo và không thay thế bác sĩ chuyên môn.*"
            if "spo2" in msg_lower:
                return "SpO2 đo lượng oxy trong máu của bạn. Bình thường SpO2 ở mức 95% - 100%. Nếu dưới 90%, đây có thể là dấu hiệu nguy hiểm và bạn cần liên hệ bác sĩ ngay.\\n\\n*CardioGuard AI chỉ hỗ trợ tham khảo và không thay thế bác sĩ chuyên môn.*"
            if "huyết áp" in msg_lower:
                return "Huyết áp bao gồm số tâm thu và tâm trương. Mức 140/90 mmHg là ngưỡng bắt đầu của tăng huyết áp (cao huyết áp). Bạn nên theo dõi thường xuyên và giảm muối trong khẩu phần ăn.\\n\\n*CardioGuard AI chỉ hỗ trợ tham khảo và không thay thế bác sĩ chuyên môn.*"
            
            return f"Chào bạn, tôi là trợ lý AI. Hiện tại hệ thống đang chạy ở chế độ mô phỏng (chưa cấu hình API Key thật). Câu hỏi của bạn là: '{message}'.\\nTôi khuyên bạn nên kiểm tra lại các chỉ số sức khỏe hàng ngày nhé!\\n\\n*CardioGuard AI chỉ hỗ trợ tham khảo và không thay thế bác sĩ chuyên môn.*"
            
        elif role == "doctor":
            if "tóm tắt" in msg_lower:
                return "## Tóm tắt bệnh nhân\\n- **Nguy cơ**: Trung bình\\n- **SpO2 gần nhất**: 96%\\n- **Nhịp tim**: Đang có xu hướng dao động nhẹ (75 - 88 bpm)\\n\\n**Đề xuất**: Tiếp tục theo dõi qua camera."
            return "Dữ liệu phân tích cho thấy không có bất thường nghiêm trọng. Tuy nhiên, hệ thống hiện đang chạy ở chế độ mô phỏng (Mock Mode) vì chưa có API Key của AI Model."
            
        return "Tôi không hiểu yêu cầu."

    @staticmethod
    async def analyze_patient_data(patient_id: str, sensor_data: List[Dict], alerts: List[Dict]) -> str:
        """
        Analyze patient data to generate an insight summary for doctor.
        """
        context = {
            "patient_id": patient_id,
            "recent_sensor_data": sensor_data[-5:] if sensor_data else [],
            "recent_alerts": alerts[-3:] if alerts else []
        }
        
        prompt = "Hãy phân tích nhanh dữ liệu sau và đưa ra 3 điểm chú ý nhất (bullet points) về bệnh nhân này."
        return await AIService.generate_chat_response("doctor", prompt, context)

ai_service = AIService()
