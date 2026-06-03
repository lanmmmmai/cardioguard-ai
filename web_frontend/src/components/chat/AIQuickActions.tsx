/**
 * Mục đích: Hiển thị lưới các nút hành động nhanh đã được định nghĩa sẵn cho trợ lý chat AI.
 * Luồng xử lý: Hiển thị bộ hành động theo vai trò (bệnh nhân vs bác sĩ); gọi hàm onSelect với
 *              chuỗi truy vấn tương ứng khi người dùng bấm vào một nút.
 * Quan hệ: Là component con của ChatWindow; cung cấp các gợi ý truy vấn cho luồng nhập chat.
 */
import React from 'react';
import { Activity, HeartPulse, Pill, CalendarClock, Zap } from 'lucide-react';

interface QuickAction {
  label: string;
  query: string;
  icon: React.ReactNode;
}

interface AIQuickActionsProps {
  role: 'patient' | 'doctor';
  onSelect: (query: string) => void;
}

const PATIENT_ACTIONS: QuickAction[] = [
  { label: 'Kiểm tra sức khỏe', query: 'Hãy phân tích tình trạng sức khỏe hiện tại của tôi dựa trên dữ liệu mới nhất.', icon: <Activity size={15} /> },
  { label: 'Giải thích nhịp tim', query: 'Nhịp tim của tôi hiện tại có bình thường không? Hãy giải thích.', icon: <HeartPulse size={15} /> },
  { label: 'Nhắc lịch uống thuốc', query: 'Hôm nay tôi cần uống những loại thuốc nào?', icon: <Pill size={15} /> },
  { label: 'Lịch khám sắp tới', query: 'Tôi có lịch hẹn khám nào sắp tới không?', icon: <CalendarClock size={15} /> },
];

const DOCTOR_ACTIONS: QuickAction[] = [
  { label: 'Bệnh nhân nguy cơ cao', query: 'Liệt kê các bệnh nhân có chỉ số bất thường hoặc nguy cơ cao hôm nay.', icon: <Zap size={15} /> },
  { label: 'Cảnh báo gần đây', query: 'Tóm tắt các cảnh báo (alerts) quan trọng trong 24h qua.', icon: <Activity size={15} /> },
];

/**
 * Component AIQuickActions — hiển thị các nút gợi ý ngữ cảnh cho AI chat.
 * Hành động của bệnh nhân bao gồm kiểm tra sức khỏe/nhắc thuốc;
 * Hành động của bác sĩ bao gồm danh sách bệnh nhân nguy cơ cao và tóm tắt cảnh báo.
 */
export const AIQuickActions: React.FC<AIQuickActionsProps> = ({ role, onSelect }) => {
  const actions = role === 'patient' ? PATIENT_ACTIONS : DOCTOR_ACTIONS;

  return (
    <div className="ai-quick-actions">
      <h4 className="quick-actions-title">Gợi ý câu hỏi:</h4>
      <div className="quick-actions-grid">
        {actions.map((action, idx) => (
          <button
            key={idx}
            className="quick-action-btn"
            onClick={() => onSelect(action.query)}
            type="button"
          >
            <span className="qa-icon">{action.icon}</span>
            <span className="qa-label">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
