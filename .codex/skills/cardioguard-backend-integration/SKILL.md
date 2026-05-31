---
name: cardioguard-backend-integration
description: Project-local backend integration and security guidelines for CardioGuard AI. Covers DB connection pooling, user synchronization, WebSocket safety, and Email CMS integration.
---

# CardioGuard Backend Integration & Architecture Rules

## Scope

Use this skill for backend development, database schema migrations, authorization controls, and API integrations in:

- `backend`: FastAPI services, SQLAlchemy, PostgreSQL (Supabase), Uvicorn.
- `web_frontend`: Integrations with backend APIs, authentication contexts, and WebSocket connections (`useWebSocket.ts`).

## Core Rules

### 1. Database Connection & Pooling (Critical)
- **Do NOT use `NullPool`** for async database engines in production or active dev servers. It causes aggressive connection recreation, network latency, and can trigger CORS blocks or timeouts.
- **Always use Connection Pooling** (e.g., `pool_size=10`, `max_overflow=20`) in `sqlalchemy_async.py` or equivalent config.
- Keep the database connections bounded. Ensure clean startup and shutdown events in `main.py`.

### 2. User Synchronization & Referential Integrity
- The `users` table is the core auth table. The `patients` and `doctors` tables store role-specific metadata.
- **Patient Synchronization**: Whenever a user with `role = 'patient'` is created or updated by an Admin (`POST /admin/users` or `PUT /admin/users/{user_id}`), **always insert or sync** a corresponding profile in the `patients` table.
- **Safe Deletion**: Prior to deleting a user from `users`, cleanly delete their profile in `patients` or `doctor_patient` tables to avoid `FOREIGN KEY constraint` database failures.

### 3. Authorization & Security Guardrails
- **Protect Admin APIs**: Every endpoint under `/admin/...` must be explicitly protected with the `require_admin` dependency. Never expose structural tables or configuration parameters without authorization checks.
- **Password Strength & Hashing**: All user creation and manual password resets must enforce the project's strong password policy. Always hash passwords before writing them to the database using `hash_password`.

### 4. Dynamic Email CMS & Variable Enrichment
- **Unified Rendering**: Always use the shared rendering utility `render_template` from `app.services.email_service` for email layouts, preview, and sending. Do not duplicate template rendering logic in separate routers.
- **Variable Enrichment**: Ensure flexible support for variables in database templates. Support cross-mappings such as:
  - `otp` ⇄ `otp_code`
  - `new_password` ⇄ `otp` / `otp_code`
- **Audit Logging**: Every system-automated or manually triggered email must write a log record in the `email_logs` table with `created_by` set to `'system'` or the active administrator's ID.

### 5. WebSocket Connection & Cleanups
- In `web_frontend/src/hooks/useWebSocket.ts`, React StrictMode in development will mount and unmount components instantly, causing connection churn.
- **Intentional Closures**: Use flags (like `intentionalCloseRef`) to distinguish between expected cleanups and sudden disconnects. This prevents red WebSocket disconnect warnings from flooding the browser developer tools.
- **State Cleanups**: Ensure that all WebSocket subscriptions and listener events are properly unmounted on component destruction.
