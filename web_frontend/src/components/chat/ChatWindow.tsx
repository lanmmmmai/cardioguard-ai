/**
 * Mục đích: Cửa sổ chat AI với lịch sử tin nhắn, biểu mẫu gửi, hiệu ứng gõ chữ và mô phỏng streaming.
 * Luồng xử lý: Gửi tin nhắn người dùng đến /api/chat/send; nhận phản hồi AI và mô phỏng streaming
 *              từng từ với cập nhật trạng thái theo lô (sửa lỗi FE-14); tự động cuộn đến tin nhắn mới nhất.
 * Quan hệ: Sử dụng MessageBubble để hiển thị từng tin nhắn; sử dụng AuthContext để lấy token;
 *          Có thể nhận contextData cho ngữ cảnh cụ thể của bệnh nhân.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { buildApiUrl } from '../../config';
import { useAuth } from '../../auth/AuthContext';
import { MessageBubble, ChatMessage } from './MessageBubble';

interface ChatWindowProps {
  role: 'patient' | 'doctor';
  contextData?: unknown;
  placeholder?: string;
}

/**
 * Component ChatWindow — giao diện chat AI đầy đủ với danh sách tin nhắn, biểu mẫu nhập,
 * cập nhật UI lạc quan và hiển thị phản hồi streaming mô phỏng.
 */
export const ChatWindow: React.FC<ChatWindowProps> = ({ role, contextData, placeholder = "Hỏi trợ lý AI..." }) => {
  const { accessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Tải lịch sử phiên làm việc nếu cần (đơn giản hóa: bắt đầu mới trừ khi có yêu cầu rõ ràng)
  
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    setChatError(null);
    
    // Thêm tin nhắn người dùng một cách lạc quan (optimistic)
    const tempUserId = `u-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempUserId, sender: 'user', message: userText }]);
    setLoading(true);

    try {
      const res = await fetch(buildApiUrl('/api/chat/send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: userText,
          session_id: sessionId,
          role: role,
          context_data: contextData
        }),
      });

      if (!res.ok) throw new Error('Lỗi gửi tin nhắn');
      
      const data = await res.json();
      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
      }

      // Hiệu ứng gõ chữ mô phỏng cho phản hồi AI — tách văn bản thành các từ và stream chúng
      const aiResponseText = data.ai_message.message;
      const aiMsgId = data.ai_message.id;
      
      setMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', message: '', isStreaming: true }]);
      
      // Mô phỏng các đoạn stream
      const chunks = aiResponseText.split(' ');
      let currentText = '';
      
      let batchUpdateCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (!isMountedRef.current) {
          return;
        }
        currentText += (i === 0 ? '' : ' ') + chunks[i];
        batchUpdateCount++;
        
        // Cập nhật trạng thái theo lô để ngăn render quá nhiều lần (sửa lỗi FE-14)
        if (batchUpdateCount >= 4 || i === chunks.length - 1) {
          setMessages(prev => 
            prev.map(m => m.id === aiMsgId ? { ...m, message: currentText } : m)
          );
          batchUpdateCount = 0;
          await new Promise(r => setTimeout(r, 40 + Math.random() * 40));
        }
      }
      
      setMessages(prev => 
        prev.map(m => m.id === aiMsgId ? { ...m, isStreaming: false } : m)
      );

    } catch (err: any) {
      if (!isMountedRef.current) {
        return;
      }
      setChatError('Không thể gửi tin nhắn tới trợ lý AI. Vui lòng thử lại.');
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, sender: 'ai', message: '⚠️ Lỗi kết nối AI. Vui lòng thử lại.' }]);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="chat-window-container">
      <div className="chat-messages-area">
        {messages.length === 0 && (
          <div className="chat-empty-state">
            <Sparkles size={48} className="chat-empty-icon" />
            <h3>Trợ lý Sức khỏe CardioGuard AI</h3>
            <p>Xin chào! Tôi là Trợ lý AI chuyên khoa tim mạch của bạn. Bạn muốn phân tích chỉ số, giải đáp thắc mắc sức khỏe hay tóm tắt thông tin nào hôm nay?</p>
            <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', maxWidth: '480px', textAlign: 'center', margin: '16px auto 0' }}>
              <strong>Lưu ý quan trọng:</strong> Trợ lý AI chỉ cung cấp thông tin mang tính hỗ trợ tham khảo lâm sàng và không thay thế cho các chẩn đoán chuyên môn, tư vấn hay phác đồ điều trị trực tiếp từ Bác sĩ phụ trách.
            </div>
          </div>
        )}
        
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        
        {loading && !messages.find(m => m.isStreaming) && (
          <div className="chat-message-row ai">
            <div className="chat-message-avatar"><Loader2 size={16} className="spin-anim" /></div>
            <div className="chat-message-bubble loading">AI đang suy nghĩ...</div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="chat-input-area">
        {chatError && <div className="form-error mb-2">{chatError}</div>}
        <form onSubmit={handleSend} className="chat-input-form">
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            aria-label="Nội dung câu hỏi gửi tới trợ lý AI"
          />
          <button type="submit" className="chat-send-btn" disabled={!input.trim() || loading} aria-label="Gửi tin nhắn">
            <Send size={18} />
          </button>
        </form>
        <div className="chat-disclaimer">
          CardioGuard AI chỉ hỗ trợ tham khảo và không thay thế bác sĩ chuyên môn.
        </div>
      </div>
    </div>
  );
};
