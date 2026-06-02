# Agent Instructions

This repository is CardioGuard AI, a multi-platform healthcare monitoring app:

- `backend`: FastAPI services and database/API logic.
- `web_frontend`: React 18, TypeScript, Vite, CSS variables, `lucide-react`.
- `mobile_app`: Flutter app with Provider, realtime telemetry, custom ECG and 3D heart painters.
- `ai_model`: model training and inference assets.

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

For any task, read and apply the relevant skills in `.codex/skills/`:

- `.codex/skills/cardioguard-code-standards/SKILL.md` (code style, docstrings, naming conventions for all languages — apply on every coding task)
- `.codex/skills/cardioguard-testing-standards/SKILL.md` (testing frameworks, commands, and patterns per module — apply when writing tests)
- `.codex/skills/cardioguard-healthcare-ui/SKILL.md` (for web and mobile UI/UX changes)
- `.codex/skills/cardioguard-backend-integration/SKILL.md` (for backend database, APIs, authentication, and integration routers)
- `.codex/skills/cardioguard-security-privacy/SKILL.md` (for patient data privacy, RBAC, and secure session credentials)
- `.codex/skills/cardioguard-ai-guardrails/SKILL.md` (for LLM/chatbot medical disclaimers and API error boundaries)
- `.codex/skills/cardioguard-telemetry-optimization/SKILL.md` (for high-frequency WebSocket and real-time buffer optimizations)
- `.codex/skills/full-output-enforcement/SKILL.md` (when implementation requires complete, non-truncated output)

The CardioGuard skill overrides generic taste-skill advice when there is a conflict. This app is a clinical dashboard/product interface, not a landing page.

Do not use `gpt-taste`, image-first workflows, GSAP-heavy motion, or marketing-page patterns by default. Preserve existing realtime telemetry, auth, role routing, alerts, ECG, and 3D heart behavior unless the user explicitly asks to change them.

Before adding a dependency, check the relevant package file first. Keep existing icon libraries unless there is a concrete project reason to change them.

- **Git Commit Policy**: Always compile, verify, and commit changes to git immediately after making any modifications or completing a task. Never leave unstaged or uncommitted changes in the workspace when finishing a response.
- **Language Policy**: Always communicate with the user in Vietnamese.
- **Code Commenting & Documentation Policy**: Always add a detailed file header comment in every new or modified file explaining its purpose and overall flow. For any functions, classes, and complex code blocks, write detailed inline comments explaining their purpose, workflow, and what they do.
  * **Python (Backend)**: Use Google Style Python Docstrings for modules, classes, and functions (including inputs `Args`, outputs `Returns`, and exceptions `Raises`).
  * **TypeScript/React (Frontend)**: Use JSDoc/TSDoc format for functions and components to show descriptions on hover.
  * **Dart/Flutter (Mobile)**: Use triple-slash (`///`) document comments above classes and methods to enable DartDoc rendering.
  * **File Header structure**: Every file must start with a header block containing: (1) File purpose, (2) Overall workflow/logic, (3) System component relationships.
- **Bug Fix & Task Execution Workflow**: Always follow the step-by-step issue-fix and verification workflow defined in [WORKFLOW.md](.docs/WORKFLOW.md).
- **Codex Skill Compliance**: Before starting any task, check the `.codex/skills/` directory, identify which skills apply to your current task scope, and strictly follow the design principles, rules, and constraints defined in those skills.





