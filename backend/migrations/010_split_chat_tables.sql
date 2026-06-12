-- Migration 010: Tách bảng chatbot_messages ra khỏi bảng chat_messages dùng cho ứng dụng di động CRUD

-- Tạo bảng chatbot_messages riêng biệt để lưu tin nhắn từ chatbot AI, tách biệt khỏi tin nhắn người dùng thông thường
CREATE TABLE IF NOT EXISTS chatbot_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Khóa ngoại tham chiếu đến bảng chat_sessions, tự động xóa tin nhắn khi session bị xóa
    session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    -- Người gửi tin nhắn: user người dùng hoặc ai trí tuệ nhân tạo
    sender      TEXT        NOT NULL,
    -- Nội dung tin nhắn dạng văn bản
    message     TEXT        NOT NULL,
    -- Ngữ cảnh tin nhắn dạng JSONB chứa dữ liệu bổ sung ví dụ dữ liệu cảm biến tại thời điểm gửi
    context     JSONB,
    -- Thời điểm tạo tin nhắn, mặc định là thời gian hiện tại
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tạo chỉ mục trên cột session_id để truy vấn nhanh tin nhắn chatbot theo phiên hội thoại
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_session_id
ON chatbot_messages(session_id);

-- Tạo chỉ mục trên cột created_at để sắp xếp và lọc tin nhắn theo thời gian
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_created_at
ON chatbot_messages(created_at);

-- Khối PL/pgSQL để di chuyển dữ liệu từ bảng chat_messages cũ sang bảng chatbot_messages mới
DO $$
DECLARE
    has_chat_messages_table BOOLEAN;
    has_session_id_col BOOLEAN;
    has_sender_col BOOLEAN;
BEGIN
    -- Kiểm tra xem bảng chat_messages có tồn tại trong cơ sở dữ liệu hay không
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'chat_messages'
    ) INTO has_chat_messages_table;
    -- Nếu bảng chat_messages tồn tại, kiểm tra các cột cần thiết
    IF has_chat_messages_table THEN
        -- Kiểm tra sự tồn tại của cột session_id trong bảng chat_messages
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'session_id'
        ) INTO has_session_id_col;
        -- Kiểm tra sự tồn tại của cột sender trong bảng chat_messages
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'chat_messages' AND column_name = 'sender'
        ) INTO has_sender_col;
        -- Chỉ thực hiện di chuyển dữ liệu nếu bảng chat_messages có cấu trúc của schema chatbot cũ, có cả session_id và sender
        IF has_session_id_col AND has_sender_col THEN
            -- Chèn dữ liệu từ chat_messages vào chatbot_messages, bỏ qua các bản ghi trùng lặp theo ID
            INSERT INTO chatbot_messages (id, session_id, sender, message, context, created_at)
            SELECT
                cm.id,
                cm.session_id,
                cm.sender,
                cm.message,
                cm.context,
                cm.created_at
            FROM chat_messages cm
            ON CONFLICT (id) DO NOTHING;
        END IF;
    END IF;
END $$;
