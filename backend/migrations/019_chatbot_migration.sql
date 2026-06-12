-- =============================================================================
-- CardioGuard AI — Migration cho chatbot CMS
-- =============================================================================

-- 1. Bảng chat_sessions lưu trữ các phiên hội thoại giữa người dùng và chatbot
CREATE TABLE IF NOT EXISTS chat_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Khóa ngoại tham chiếu đến bảng users, tự động xóa session khi người dùng bị xóa
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Vai trò của người dùng trong phiên hội thoại: patient bệnh nhân hoặc doctor bác sĩ
    role        TEXT        NOT NULL,
    -- Tiêu đề của phiên hội thoại, có thể để trống
    title       TEXT,
    -- Thời điểm tạo phiên hội thoại, mặc định là thời gian hiện tại
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Thời điểm cập nhật phiên hội thoại gần nhất, mặc định là thời gian hiện tại
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tạo chỉ mục trên cột user_id để truy vấn nhanh các phiên hội thoại theo người dùng
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);

-- 2. Bảng chat_messages lưu trữ nội dung tin nhắn trong từng phiên hội thoại
CREATE TABLE IF NOT EXISTS chat_messages (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Khóa ngoại tham chiếu đến bảng chat_sessions, tự động xóa tin nhắn khi session bị xóa
    session_id  UUID        NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    -- Người gửi tin nhắn: user người dùng hoặc ai trí tuệ nhân tạo
    sender      TEXT        NOT NULL,
    -- Nội dung tin nhắn dạng văn bản
    message     TEXT        NOT NULL,
    -- Ngữ cảnh tin nhắn dạng JSONB, lưu thông tin bổ sung như dữ liệu cảm biến tại thời điểm gửi tin nhắn
    context     JSONB,
    -- Thời điểm tạo tin nhắn, mặc định là thời gian hiện tại
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tạo chỉ mục trên cột session_id để truy vấn nhanh tin nhắn theo phiên hội thoại
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
-- Tạo chỉ mục trên cột created_at để sắp xếp và lọc tin nhắn theo thời gian
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- 3. Bảng ai_recommendations lưu trữ các khuyến nghị do AI tạo ra cho bệnh nhân
CREATE TABLE IF NOT EXISTS ai_recommendations (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Khóa ngoại tham chiếu đến bảng users bệnh nhân, tự động xóa khuyến nghị khi bệnh nhân bị xóa
    patient_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Mức độ nghiêm trọng của khuyến nghị: info thông tin, warning cảnh báo, critical nguy kịch
    severity        TEXT        NOT NULL DEFAULT 'info',
    -- Nội dung khuyến nghị do AI đưa ra
    recommendation  TEXT        NOT NULL,
    -- Nguồn tạo ra khuyến nghị, mặc định là system_ai hệ thống AI
    generated_by    TEXT        NOT NULL DEFAULT 'system_ai',
    -- Trạng thái đã xử lý hay chưa, mặc định là FALSE chưa xử lý
    is_resolved     BOOLEAN     NOT NULL DEFAULT FALSE,
    -- Thời điểm tạo khuyến nghị, mặc định là thời gian hiện tại
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tạo chỉ mục trên cột patient_id để truy vấn nhanh các khuyến nghị theo bệnh nhân
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_patient_id ON ai_recommendations(patient_id);
