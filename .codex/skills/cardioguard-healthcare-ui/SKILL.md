---
name: cardioguard-healthcare-ui
description: Project-local UI guidance for CardioGuard AI. Use when changing web_frontend or mobile_app UI/UX, especially with redesign-existing-projects, while preserving clinical clarity and existing architecture.
---

# CardioGuard Healthcare UI Skill

## Scope

Use this skill for UI/UX changes in:

- `web_frontend`: React 18, TypeScript, Vite, CSS variables in `src/index.css`, `lucide-react`.
- `mobile_app`: Flutter, Provider, custom painters, `lucide_icons`, `fl_chart`.

This skill is not for backend OTP, database, AI model, or API work unless the task directly affects UI behavior.

## Project Fit

CardioGuard is a healthcare monitoring product with realtime vitals, ECG, alerts, role-based dashboards, authentication, and patient workflows. Treat it as a clinical product interface, not a marketing page.

Prioritize:

- Clear reading of vitals, ECG, alert severity, patient identity, and realtime status.
- Trust, calmness, and operational focus.
- Accessibility, contrast, keyboard focus, responsive behavior, and reduced motion.
- Data density where clinicians need scanability.
- Consistent Vietnamese user-facing copy unless the surrounding screen is already English.

Avoid:

- GSAP-heavy scroll experiences, cinematic landing-page motion, or decorative animation.
- Generic hero sections, stock-photo marketing layouts, and image-first workflows for dashboards.
- Hiding critical alerts inside subtle styling.
- Replacing existing icon libraries just to satisfy a style preference.
- New dependencies unless the package file has been checked and the benefit is concrete.

## Applying `redesign-existing-projects`

Use `.codex/skills/redesign-existing-projects/SKILL.md` as an audit checklist, but these CardioGuard overrides win:

- Dense dashboard layouts are allowed when they improve clinical scanability.
- A left sidebar is acceptable because this app has role-based operational navigation.
- `lucide-react` and `lucide_icons` are already part of the project and should remain the default icon families.
- Do not replace functional ECG, 3D heart, WebSocket telemetry, alert, auth, or role-routing behavior for visual reasons.
- Do not add decorative patient data, fake medical claims, or invented diagnostic conclusions.
- Keep alert colors semantically stable: critical, warning, normal, oxygen, blood pressure, and heart rate must stay easy to distinguish.

## Design Rules

- Use tabular numbers or monospace treatment for vitals and timestamps where alignment matters.
- Preserve the existing dark/light theme behavior and make new components work in both themes.
- Prefer CSS variables and shared classes over inline styles for repeatable UI.
- Loading, empty, error, disabled, realtime disconnected, and permission-denied states should be explicit.
- Motion should support comprehension: pulse, heartbeat, ECG, state transition. It should not distract from monitoring.
- Respect `prefers-reduced-motion` for nonessential animation.
- Buttons and form controls must have visible hover, active, disabled, and focus states.
- On mobile, avoid fixed widths that clip Vietnamese labels or patient names.
- **Code Commenting & Documentation (Mandatory)**: Every new or modified frontend/UI file must have a detailed header comment summarizing the component's purpose, design context, and state structure. Additionally, write comprehensive inline comments explaining the purpose, execution flow, and logic for state hooks, events, helper functions, and custom canvas/painters (e.g. ECG rendering, 3D heart).


## Workflow

1. Scan the current component, CSS, data flow, and dependencies before editing.
2. Diagnose UI problems with clinical clarity first, visual taste second.
3. Make targeted changes in the existing stack.
4. Keep behavior, routing, auth, and telemetry contracts intact.
5. Run the narrowest useful verification, usually `npm run build` for `web_frontend` or Flutter analysis/build commands for `mobile_app` when available.

