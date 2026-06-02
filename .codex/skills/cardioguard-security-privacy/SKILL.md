---
name: cardioguard-security-privacy
description: Rules and guidelines for security, authorization (RBAC), and patient data privacy (HIPAA/GDPR compliance) in CardioGuard AI.
---

# CardioGuard Security & Medical Privacy Skill

## Scope
Use this skill when implementing or modifying endpoints, database operations, user session handling, and logs in:
- `backend`: FastAPI API routers, middleware, and database operations.
- `web_frontend` & `mobile_app`: Auth providers, storage helper functions, and error logs.

## Rules

### 1. Patient PII Protection (Privacy)
- **Do NOT Log PII**: Never log Personally Identifiable Information (PII) such as patient names, emails, medical conditions, or raw clinical telemetry to console logs, error logs, or terminal output.
- **Log Masking**: If logging is required for system audit, mask sensitive fields (e.g., log `user_id` instead of raw email, mask phone numbers).

### 2. Role-Based Access Control (RBAC) Verification
- **Explicit Role Guards**: Every API endpoint must explicitly verify the caller's role using dependency injection (e.g., `require_admin`, `require_doctor`, `require_patient`).
- **Resource Ownership**: Validate resource ownership before returning data.
  - A *Patient* must ONLY access their own vitals/telemetry.
  - A *Doctor* must ONLY access data for patients assigned to them (check `doctor_patient` relationship).
  - An *Admin* must have specific administrative validation for modifying users.

### 3. Session & Token Security
- **JWT Storage**: In `web_frontend`, never store the access token in unprotected global state. In mobile, store credentials securely using `FlutterSecureStorage` with error handling.
- **Sensitive Keys**: Never hardcode secret keys or API keys. Ensure they are loaded from environment variables and checked at startup.

### 4. Client-Side Data Security
- **Storage Encryption**: If patient profiles or medical history must be cached client-side, encrypt the data before saving it to local/session storage.
- **Clean Session Destruct**: Ensure that upon logout, all session storages, tokens, cached data, and state variables are completely cleared to prevent session hijacking.
