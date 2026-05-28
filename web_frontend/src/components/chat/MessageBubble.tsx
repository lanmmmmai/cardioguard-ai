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
