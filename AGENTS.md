# Agent Instructions

This repository is CardioGuard AI, a multi-platform healthcare monitoring app:

- `backend`: FastAPI services and database/API logic.
- `web_frontend`: React 18, TypeScript, Vite, CSS variables, `lucide-react`.
- `mobile_app`: Flutter app with Provider, realtime telemetry, custom ECG and 3D heart painters.
- `ai_model`: model training and inference assets.

For UI/UX redesign or visual polish tasks, read and apply:

- `.codex/skills/cardioguard-healthcare-ui/SKILL.md`
- `.codex/skills/redesign-existing-projects/SKILL.md`

The CardioGuard skill overrides generic taste-skill advice when there is a conflict. This app is a clinical dashboard/product interface, not a landing page.

Do not use `gpt-taste`, image-first workflows, GSAP-heavy motion, or marketing-page patterns by default. Preserve existing realtime telemetry, auth, role routing, alerts, ECG, and 3D heart behavior unless the user explicitly asks to change them.

Before adding a dependency, check the relevant package file first. Keep existing icon libraries unless there is a concrete project reason to change them.

- **Git Commit Policy**: Always compile, verify, and commit changes to git immediately after making any modifications or completing a task. Never leave unstaged or uncommitted changes in the workspace when finishing a response.
