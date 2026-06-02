# Project skills

This folder stores project-local agent skills for CardioGuard AI.

## 📁 Sơ đồ cấu trúc tài liệu hỗ trợ Agent (Agent Documentation Map)

Dưới đây là sơ đồ tổ chức tài liệu và toàn bộ cấu trúc dự án CardioGuard AI:

```text
.
├── .docs/                             <-- Thư mục chứa chỉ dẫn cốt lõi của Agent (Core Guidelines)
│   ├── AGENTS.md                      <-- 🧠 Bộ não dự án (Mục tiêu, Tech stack, Quy tắc chung, Sơ đồ tài liệu)
│   ├── WORKFLOW.md                    <-- 🔄 Quy trình chuẩn sửa lỗi & kiểm thử (Standard Issue-Fix Cycle)
│   └── CODE_REVIEW.md                 <-- 📋 Danh sách lỗi cần khắc phục từ báo cáo đánh giá (Task Backlog)
│
├── .codex/
│   └── skills/                        <-- Thư mục chứa các kỹ năng tái sử dụng (Reusable Skills)
│       ├── README.md                  <-- 🧭 Bản đồ kỹ năng & Hướng dẫn chọn kỹ năng phù hợp
│       ├── cardioguard-code-standards/
│       │   └── SKILL.md               <-- 📏 Quy chuẩn viết code, đặt tên & comment (Tất cả ngôn ngữ)
│       ├── cardioguard-healthcare-ui/
│       │   └── SKILL.md               <-- 🎨 Quy tắc thiết kế UI/UX y tế (Độ rõ nét lâm sàng, Responsive)
│       ├── cardioguard-backend-integration/
│       │   └── SKILL.md               <-- 🔌 Quy tắc tích hợp Backend, DB, API & Realtime WebSocket
│       ├── cardioguard-security-privacy/
│       │   └── SKILL.md               <-- 🔐 Bảo mật dữ liệu bệnh nhân (HIPAA/GDPR) & Phân quyền (RBAC)
│       ├── cardioguard-ai-guardrails/
│       │   └── SKILL.md               <-- 🤖 Giới hạn AI Chatbot, cảnh báo y tế & miễn trừ trách nhiệm
│       ├── cardioguard-telemetry-optimization/
│       │   └── SKILL.md               <-- ⚡ Tối ưu hóa truyền dữ liệu realtime tần số cao (ECG, Vitals)
│       ├── cardioguard-testing-standards/
│       │   └── SKILL.md               <-- 🧪 Tiêu chuẩn và các câu lệnh chạy kiểm thử (Unit, Integration Test)
│       └── full-output-enforcement/
│           └── SKILL.md               <-- 📝 Ép buộc xuất code đầy đủ, không sử dụng code placeholder (...)
│
├── backend/                           <-- 🐍 FastAPI Backend services, database & API logic
├── web_frontend/                      <-- ⚛️ React 18, TypeScript, Vite Web App
├── mobile_app/                        <-- 📱 Flutter Mobile App (Provider, Realtime Telemetry, Custom ECG)
├── ai_model/                          <-- 🤖 Model training and inference assets
├── hardware/                          <-- 🔌 IoT & Hardware sensor communication code
└── README.md                          <-- 📖 File giới thiệu chung của toàn bộ dự án
```

## 📋 Chi tiết các kỹ năng (Detailed Skills)

- **`cardioguard-code-standards`**: Unified code style, documentation, naming conventions, and formatting rules for all languages (Python, TypeScript, Dart). Apply this skill on every coding task to ensure consistent, AI-readable code.
- **`cardioguard-healthcare-ui`**: CardioGuard-specific guardrails for web and mobile UI changes. Use this so visual polish does not override clinical clarity, realtime readability, accessibility, or existing app architecture.
- **`cardioguard-backend-integration`**: Quy tắc và hướng dẫn tích hợp cơ sở dữ liệu, APIs, đồng bộ người dùng, bảo mật phân quyền và quản lý an toàn kết nối WebSocket/DB.
- **`cardioguard-testing-standards`**: Testing frameworks, commands, file conventions, and patterns per module (backend: unittest, web_frontend: Vitest, mobile_app: flutter_test). Apply this skill when writing or modifying tests.
- **`full-output-enforcement`**: Copied from `Leonxlnx/taste-skill` at `skills/output-skill`. Use it when tasks require full, non-truncated implementation output.

## ⚙️ Hướng dẫn chọn Kỹ năng phù hợp (Selection Notes)

- Do not use `gpt-taste` by default. It pushes heavy GSAP and marketing-page motion that does not fit this healthcare monitoring app.
- Do not use `image-to-code` by default. It is useful for visual landing pages, but too heavy for routine dashboard and product UI work.
- Do not use `imagegen-frontend-mobile` by default for this repository. It is image-generation-only and does not produce Flutter code for production app screens.
- Do not use the default `design-taste-frontend` as a blanket rule. It explicitly targets landing pages, portfolios, and redesigns, not dense realtime dashboards or data tables.

