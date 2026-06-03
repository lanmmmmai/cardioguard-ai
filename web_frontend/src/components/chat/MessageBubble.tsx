/**
 * Mục đích: Hiển thị một bong bóng tin nhắn chat đơn lẻ (người dùng hoặc AI) với hỗ trợ markdown.
 * Luồng xử lý: Phân biệt tin nhắn AI và người dùng để tạo kiểu; hiển thị nội dung AI qua ReactMarkdown
 *              với plugin GFM; hiển thị con trỏ nhấp nháy khi đang stream.
 * Quan hệ: Là component con của ChatWindow; xuất interface ChatMessage được component cha sử dụng.
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  message: string;
  created_at?: string;
  isStreaming?: boolean;
}

interface MessageBubbleProps {
  msg: ChatMessage;
}

/**
 * Component MessageBubble — hiển thị markdown cho tin nhắn AI, văn bản thuần cho tin nhắn người dùng,
 * và hiển thị con trỏ streaming khi phản hồi AI đang được xử lý.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({ msg }) => {
  const isAI = msg.sender === 'ai';

  return (
    <div className={`chat-message-row ${isAI ? 'ai' : 'user'}`}>
      <div className="chat-message-avatar">
        {isAI ? <Bot size={18} /> : <User size={18} />}
      </div>
      <div className="chat-message-bubble">
        {isAI ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.message}
            </ReactMarkdown>
            {msg.isStreaming && <span className="typing-cursor"></span>}
          </div>
        ) : (
          <div className="user-text">{msg.message}</div>
        )}
      </div>
    </div>
  );
};
