import React, { useEffect, useState } from 'react';
import { Bot, HeartPulse, ShieldCheck } from 'lucide-react';
import { ChatWindow } from '../components/chat/ChatWindow';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';

export const PatientChatbot: React.FC = () => {
  const { accessToken } = useAuth();
  const [contextData, setContextData] = useState<any>(null);

  // Fetch recent sensor data to use as context
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch(`${API_URL}/sensors/history`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        // Just take the latest 5 records for context
        if (data.items) {
          setContextData({ recent_sensor_data: data.items.slice(0, 5) });
        }
      } catch (err) {
        console.error("Failed to fetch context", err);
      }
    };
    fetchContext();
  }, [accessToken]);

  // Hacky way to inject query into ChatWindow
  // In a real app we'd lift state up, but since ChatWindow manages its own input, we can use a custom event or a ref.
  // For simplicity here, we'll just show the AIQuickActions visually. (We'll update ChatWindow to accept a prop if needed later).

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
