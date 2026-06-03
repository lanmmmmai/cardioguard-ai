/**
 * Mục đích: Trợ lý sức khỏe AI dành cho bệnh nhân. Cung cấp giao diện hội thoại
 *           nơi bệnh nhân có thể hỏi về các chỉ số sinh tồn, nhận thông tin sức khỏe
 *           và theo dõi các chỉ số tim mạch.
 * Luồng xử lý: 1. Khi khởi tạo, tải lịch sử cảm biến gần đây từ backend →
 *            2. Truyền dữ liệu đó làm ngữ cảnh vào ChatWindow → 3. Bệnh nhân nhập
 *            câu hỏi và nhận phản hồi từ AI.
 * Quan hệ:
 *   - Component ChatWindow cho hội thoại AI
 *   - AuthContext cho access token và định danh phiên
 *   - Điểm cuối lịch sử cảm biến (API_URL/sensors/history)
 */
import React, { useEffect, useState } from 'react';
import { Bot, HeartPulse, ShieldCheck } from 'lucide-react';
import { ChatWindow } from '../components/chat/ChatWindow';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';

/**
 * Trang chatbot chính cho bệnh nhân. Tải dữ liệu cảm biến gần đây làm ngữ cảnh
 * hội thoại và hiển thị ChatWindow cho Q&A về sức khỏe.
 */
export const PatientChatbot: React.FC = () => {
  const { accessToken } = useAuth();
  const [contextData, setContextData] = useState<unknown>(null);

  // Tải dữ liệu cảm biến gần đây để sử dụng làm ngữ cảnh
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(`${API_URL}/sensors/history`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        // Chỉ lấy 5 bản ghi gần nhất làm ngữ cảnh
        if (data.items) {
          setContextData({ recent_sensor_data: data.items.slice(0, 5) });
        }
      } catch (err) {
        console.error("Không thể tải ngữ cảnh", err);
      }
    };
    fetchContext();
  }, [accessToken]);

  return (
    <div className="patient-chatbot-page">
      <div className="page-header">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bot size={28} style={{ color: 'var(--color-primary)' }} />
          Trợ lý sức khỏe AI
        </h1>
        <p className="page-subtitle">Hỏi đáp, phân tích và theo dõi sức khỏe tim mạch của bạn.</p>
      </div>

      <div className="chatbot-layout">
        <div className="chatbot-main-col">
          <div className="panel chat-panel">
            <ChatWindow 
              role="patient" 
              contextData={contextData} 
              placeholder="Ví dụ: Nhịp tim 85 của tôi có bình thường không?"
            />
          </div>
        </div>

        <div className="chatbot-side-col">
          <div className="panel info-panel">
            <div className="info-panel-header">
              <ShieldCheck size={20} className="text-safe" />
              <h3>Bảo mật y tế</h3>
            </div>
            <p className="info-panel-desc">
              Dữ liệu trò chuyện của bạn được mã hóa an toàn và chỉ sử dụng để phân tích sức khỏe cá nhân.
            </p>
          </div>
          
          <div className="panel info-panel mt-4">
            <div className="info-panel-header">
              <HeartPulse size={20} className="text-primary" />
              <h3>Liên kết dữ liệu</h3>
            </div>
            <p className="info-panel-desc">
              AI được cấp quyền đọc dữ liệu nhịp tim và SpO2 theo thời gian thực của bạn để đưa ra phân tích chính xác nhất.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
