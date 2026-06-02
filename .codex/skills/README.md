# Project skills

This folder stores project-local agent skills for CardioGuard AI.

Installed external skill:

- `redesign-existing-projects`: copied from `Leonxlnx/taste-skill` at `skills/redesign-skill`. Use it for focused UI audit and redesign work on existing screens.
- `full-output-enforcement`: copied from `Leonxlnx/taste-skill` at `skills/output-skill`. Use it when tasks require full, non-truncated implementation output.

Project-local skill:

- `cardioguard-healthcare-ui`: CardioGuard-specific guardrails for web and mobile UI changes. Use this alongside `redesign-existing-projects` so visual polish does not override clinical clarity, realtime readability, accessibility, or existing app architecture.
- `cardioguard-backend-integration`: Quy tắc và hướng dẫn tích hợp cơ sở dữ liệu, APIs, đồng bộ người dùng, bảo mật phân quyền và quản lý an toàn kết nối WebSocket/DB.
- `cardioguard-code-standards`: Unified code style, documentation, naming conventions, and formatting rules for all languages (Python, TypeScript, Dart). Apply this skill on every coding task to ensure consistent, AI-readable code.
- `cardioguard-testing-standards`: Testing frameworks, commands, file conventions, and patterns per module (backend: unittest, web_frontend: Vitest, mobile_app: flutter_test). Apply this skill when writing or modifying tests.

Selection notes:

- Do not use `gpt-taste` by default. It pushes heavy GSAP and marketing-page motion that does not fit this healthcare monitoring app.
- Do not use `image-to-code` by default. It is useful for visual landing pages, but too heavy for routine dashboard and product UI work.
- Do not use `imagegen-frontend-mobile` by default for this repository. It is image-generation-only and does not produce Flutter code for production app screens.
- Do not use the default `design-taste-frontend` as a blanket rule. It explicitly targets landing pages, portfolios, and redesigns, not dense realtime dashboards or data tables.

