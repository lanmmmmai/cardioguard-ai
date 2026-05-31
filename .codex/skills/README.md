# Project skills

This folder stores project-local agent skills for CardioGuard AI.

Installed external skill:

- `redesign-existing-projects`: copied from `Leonxlnx/taste-skill` at `skills/redesign-skill`. Use it for focused UI audit and redesign work on existing screens.

Project-local skill:

- `cardioguard-healthcare-ui`: CardioGuard-specific guardrails for web and mobile UI changes. Use this alongside `redesign-existing-projects` so visual polish does not override clinical clarity, realtime readability, accessibility, or existing app architecture.

Selection notes:

- Do not use `gpt-taste` by default. It pushes heavy GSAP and marketing-page motion that does not fit this healthcare monitoring app.
- Do not use `image-to-code` by default. It is useful for visual landing pages, but too heavy for routine dashboard and product UI work.
- Do not use the default `design-taste-frontend` as a blanket rule. It explicitly targets landing pages, portfolios, and redesigns, not dense realtime dashboards or data tables.

