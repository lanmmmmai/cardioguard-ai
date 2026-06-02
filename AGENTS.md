# Agent Instructions

This repository is CardioGuard AI, a multi-platform healthcare monitoring app:

- `backend`: FastAPI services and database/API logic.
- `web_frontend`: React 18, TypeScript, Vite, CSS variables, `lucide-react`.
- `mobile_app`: Flutter app with Provider, realtime telemetry, custom ECG and 3D heart painters.
- `ai_model`: model training and inference assets.

For UI/UX redesign or visual polish tasks, read and apply:

- `.codex/skills/cardioguard-healthcare-ui/SKILL.md`
- `.codex/skills/redesign-existing-projects/SKILL.md`
- `.codex/skills/full-output-enforcement/SKILL.md` (when implementation requires complete, non-truncated output)

The CardioGuard skill overrides generic taste-skill advice when there is a conflict. This app is a clinical dashboard/product interface, not a landing page.

Do not use `gpt-taste`, image-first workflows, GSAP-heavy motion, or marketing-page patterns by default. Preserve existing realtime telemetry, auth, role routing, alerts, ECG, and 3D heart behavior unless the user explicitly asks to change them.

Before adding a dependency, check the relevant package file first. Keep existing icon libraries unless there is a concrete project reason to change them.

- **Git Commit Policy**: Always compile, verify, and commit changes to git immediately after making any modifications or completing a task. Never leave unstaged or uncommitted changes in the workspace when finishing a response.
- **Language Policy**: Always communicate with the user in Vietnamese (Luôn luôn giao tiếp với người dùng bằng tiếng Việt).
- **Code Commenting & Documentation Policy**: Always add a detailed file header comment in every new or modified file explaining its purpose and overall flow. For any functions, classes, and complex code blocks, write detailed inline comments explaining their purpose, workflow, and what they do (Luôn thêm chú thích chi tiết ở đầu mỗi tệp tin mới hoặc tệp tin được chỉnh sửa để giải thích tác dụng và luồng hoạt động tổng thể. Đối với các hàm, lớp, và các khối mã phức tạp, phải viết comment chi tiết giải thích rõ mục đích, luồng xử lý và tác dụng của chúng).
  * **Python (Backend)**: Use Google Style Python Docstrings for modules, classes, and functions (including inputs `Args`, outputs `Returns`, and exceptions `Raises`).
  * **TypeScript/React (Frontend)**: Use JSDoc/TSDoc format for functions and components to show descriptions on hover.
  * **Dart/Flutter (Mobile)**: Use triple-slash (`///`) document comments above classes and methods to enable DartDoc rendering.
  * **File Header structure**: Every file must start with a header block containing: (1) File purpose, (2) Overall workflow/logic, (3) System component relationships.


