# Agent Instructions

This repository is CardioGuard AI, a multi-platform healthcare monitoring app:

- `backend`: FastAPI services and database/API logic.
- `web_frontend`: React 18, TypeScript, Vite, CSS variables, `lucide-react`.
- `mobile_app`: Flutter app with Provider, realtime telemetry, custom ECG and 3D heart painters.
- `ai_model`: model training and inference assets.

For any task, read and apply the relevant skills in `.codex/skills/`:

- `.codex/skills/cardioguard-healthcare-ui/SKILL.md` (for web and mobile UI/UX changes)
- `.codex/skills/cardioguard-backend-integration/SKILL.md` (for backend database, APIs, authentication, and integration routers)
- `.codex/skills/cardioguard-security-privacy/SKILL.md` (for patient data privacy, RBAC, and secure session credentials)
- `.codex/skills/cardioguard-ai-guardrails/SKILL.md` (for LLM/chatbot medical disclaimers and API error boundaries)
- `.codex/skills/cardioguard-telemetry-optimization/SKILL.md` (for high-frequency WebSocket and real-time buffer optimizations)
- `.codex/skills/redesign-existing-projects/SKILL.md` (for general UI audit & polish checklists)
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
- **Bug Fix & Task Execution Workflow**: Always follow the step-by-step issue-fix and verification workflow defined in [WORKFLOW.md](file:///e:/AIoT/cardioguard-ai/WORKFLOW.md).
- **Codex Skill Compliance**: Before starting any task, check the `.codex/skills/` directory, identify which skills apply to your current task scope, and strictly follow the design principles, rules, and constraints defined in those skills.





