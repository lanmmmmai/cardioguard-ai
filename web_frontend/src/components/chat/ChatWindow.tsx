import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../auth/AuthContext';
import { MessageBubble, ChatMessage } from './MessageBubble';

interface ChatWindowProps {
  role: 'patient' | 'doctor';
  contextData?: any;
  placeholder?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ role, contextData, placeholder = "Hỏi trợ lý AI..." }) => {
  const { accessToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing session history if needed (simplified: start fresh for now unless explicit)
  
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setInput('');
    
    // Optimistic add user message
    const tempUserId = `u-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempUserId, sender: 'user', message: userText }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
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

      // Simulated typing effect for AI response
      const aiResponseText = data.ai_message.message;
      const aiMsgId = data.ai_message.id;
      
      setMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', message: '', isStreaming: true }]);
      
      // Simulate streaming chunks
      const chunks = aiResponseText.split(' ');
      let currentText = '';
      
      let batchUpdateCount = 0;
      for (let i = 0; i < chunks.length; i++) {
        currentText += (i === 0 ? '' : ' ') + chunks[i];
        batchUpdateCount++;
        
        // Batch state updates to prevent excessive re-renders (FE-14 fix)
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
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, sender: 'ai', message: '⚠️ Lỗi kết nối AI. Vui lòng thử lại.' }]);
    } finally {
      setLoading(false);
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
