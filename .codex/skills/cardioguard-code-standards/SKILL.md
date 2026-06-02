---
name: cardioguard-code-standards
description: Unified code style, documentation, naming conventions, and formatting rules for CardioGuard AI across Python, TypeScript, and Dart/Flutter.
---

# CardioGuard AI — Code Standards

## Scope

Use this skill when writing or reviewing code in any module of this project. It consolidates all code style and documentation rules into a single reference.

This skill **overrides** generic AI coding defaults. Follow these rules even if your training data suggests otherwise.

---

## 1. Universal Rules (All Languages)

### File Header Comment
Every new or modified file **must** include a header comment:

```python
# Python
# CardioGuard AI — description of this module
```
```typescript
// TypeScript
// CardioGuard AI — description of this module
```
```dart
// Dart
// CardioGuard AI — description of this module
```

### No Placeholder Code
Per `full-output-enforcement` skill, banned patterns:
- `// ...`, `// rest of code`, `// TODO`, `/* ... */`, `// similar to above`
- `// implement here`, `// continue pattern`, `// add more as needed`
- Bare `...` standing in for omitted code blocks

### Prohibited Patterns
- No hardcoded secrets, API keys, or PII in source code
- No `print()` / `console.log()` debugging left in committed code
- No commented-out dead code — remove it
- No `except: pass` or empty catch blocks without explanation

---

## 2. Python (Backend)

### Linting & Formatting
- No pyproject.toml or explicit linter config — follow rules below manually.
- Use **snake_case** for functions, variables, file names.
- Use **PascalCase** for classes.
- Use **UPPER_SNAKE_CASE** for constants.

### Imports (Ordered)
```python
# 1. Standard library
import json
import logging
from datetime import datetime, timedelta

# 2. Third-party
from fastapi import FastAPI, Response
from jose import jwt
from pydantic import Field

# 3. Local application
from app.core.config import settings
from app.core.security import hash_password
from app.models.user import UserCreate
```

### Docstrings — Google Style (Mandatory)
Every function, method, class, and module **must** have a Google-style docstring:

```python
def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt.

    Args:
        password: The plaintext password to hash.

    Returns:
        The hashed password as a UTF-8 decoded string.

    Raises:
        ValueError: If the password is empty.
    """
    ...


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a JWT access token.

    Args:
        data: Claims to include in the token (must include "sub").
        expires_delta: Optional custom expiration duration.
                       Defaults to settings.ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        Encoded JWT string.
    """
    ...


class Settings(BaseSettings):
    """Application settings loaded from environment variables.

    Uses pydantic-settings to read from .env files. Validates
    SECRET_KEY at startup.
    """
    ...
```

### Type Hints
- Use Python type hints on all function signatures.
- Prefer `| None` over `Optional[...]` (Python 3.10+ syntax).
- Use `from __future__ import annotations` if needed for forward references.

### Error Handling
- Raise specific exceptions (`ValueError`, `HTTPException`), never bare `raise`.
- Use `try/except` with specific exception types, never bare `except:`.
- Wrap AI/external service calls in try/except with friendly user-facing messages.

---

## 3. TypeScript (Web Frontend)

### Linting & Formatting
- ESLint config: `.eslintrc.cjs` with `@typescript-eslint` rules.
- TypeScript strict mode enabled in `tsconfig.json` (`strict: true`).
- Keep existing eslint rules; do not add new lint dependencies without approval.

### Naming
- **camelCase** for variables, functions, hooks (`useWebSocket`)
- **PascalCase** for components, interfaces, types, enums
- **UPPER_SNAKE_CASE** for constants (`TOKEN_KEY`, `VALID_ROLES`)
- File names: **kebab-case** (`auth-context.tsx`, not `AuthContext.tsx`)
- Test files: co-located, `{name}.test.ts`

### Imports (Ordered)
```typescript
// 1. React / framework
import React, { createContext, useContext, useState } from 'react';
// 2. Third-party libraries
import { describe, expect, it } from 'vitest';
// 3. Local modules (relative paths)
import { AuthUser, UserRole, normalizeRole } from './roles';
import { API_URL } from '../config';
```

### Interfaces & Types
- Prefer `interface` over `type` for object shapes.
- Use `type` for unions, intersections, and primitives.
- Export all shared types/interfaces.

```typescript
export type UserRole = 'admin' | 'doctor' | 'patient';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  status?: string | null;
  must_change_password?: boolean;
}
```

### JSDoc / TSDoc (Mandatory)
Every function, component, and custom hook **must** have a JSDoc comment:

```typescript
/**
 * Normalize a role string to a valid UserRole.
 * Trims whitespace and lowercases. Returns null for invalid input.
 *
 * @param role - Raw role string from API or user input
 * @returns Normalized UserRole or null
 */
export const normalizeRole = (role?: string | null): UserRole | null => {
  ...
};

/**
 * Protected route wrapper for role-based access.
 * Redirects unauthenticated users to /login.
 *
 * @param requiredRole - The role required to access the route
 * @param children - Child components to render if authorized
 */
export const ProtectedRoute: React.FC<{ requiredRole: UserRole; children: React.ReactNode }> = (...) => {
  ...
};
```

### Components
- Functional components with hooks (no class components).
- Props defined as `interface ComponentNameProps` near the component.
- Destructure props in the function signature.
- Export components as named exports (prefer `export function` over `export default`).

### Error Handling
- Use try/catch in async functions, display user-friendly messages.
- WebSocket: use `intentionalCloseRef` flag to distinguish expected vs unexpected disconnects.
- Form validation: inline error messages, never `window.alert()`.

---

## 4. Dart / Flutter (Mobile App)

### Linting & Formatting
- Uses `flutter_lints` (v3) from `analysis_options.yaml` — do not disable rules without reason.
- Run `flutter analyze` before committing code.
- Follow Dart's official style guide (effective_dart).

### Naming
- **camelCase** for variables, functions, parameters
- **PascalCase** for classes, enums, mixins, extensions
- **snake_case** for file names (`auth_provider.dart`, not `authProvider.dart`)
- **lowercase_with_underscores** for library and import paths
- **UPPER_SNAKE_CASE** for static const identifiers

### Imports (Ordered)
```dart
// 1. Flutter / Dart SDK
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
// 2. Third-party packages
import 'package:provider/provider.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
// 3. Local project
import 'screens/dashboard_screen.dart';
import 'providers/auth_provider.dart';
import 'ui/cg_theme.dart';
```

### Triple-Slash Comments (Mandatory)
Every class, method, and top-level function **must** have `///` documentation:

```dart
/// Unified color palette for CardioGuard AI.
/// Maps to semantic clinical roles (critical, warning, normal, etc.).
class CgColors {
  /// Alert: critical / emergency — use for life-threatening vitals.
  static const critical = Color(0xFFD92D20);

  /// Alert: warning / attention — use for borderline vitals.
  static const warning = Color(0xFFF79009);

  /// Normal / healthy range indicator.
  static const normal = Color(0xFF12B76A);
}
```

```dart
/// Represents a user in the CardioGuard system.
///
/// Supports JSON serialization/deserialization via [fromJson] and [toJson].
class User {
  /// Unique user identifier (UUID).
  final String id;

  /// Full display name.
  final String fullName;

  /// Creates a [User] with all required fields.
  User({required this.id, required this.fullName, ...});
}
```

### Model Pattern (JSON Serialization)
All data models **must** implement both `fromJson` and `toJson`:

```dart
class Patient {
  final String id;
  final String fullName;
  final int? heartRate;

  Patient({required this.id, required this.fullName, this.heartRate});

  factory Patient.fromJson(Map<String, dynamic> json) {
    return Patient(
      id: json['id'] ?? '',
      fullName: json['full_name'] ?? '',
      heartRate: json['heart_rate'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'full_name': fullName,
        'heart_rate': heartRate,
      };
}
```

### Provider Pattern
- Use `ChangeNotifier` + `Provider` (not Riverpod, not Bloc).
- Providers hold state and expose methods that call services then `notifyListeners()`.
- Services (API, WebSocket) are injected or instantiated inside providers.

### Widgets
- Prefer `StatelessWidget` when possible, `StatefulWidget` only when state is needed.
- Extract reusable widgets to `widgets/` or `widgets/cg/` directory.
- Use `const` constructors where possible.

### Error Handling
- Use try/catch in provider methods, emit error state to UI.
- Network calls: wrap in try/catch, set `errorMessage` on provider, show in UI.
- Never use `print()` for error logging — use `AppLogger` from `core/app_logger.dart`.

---

## 5. Version Control & Commit Standards

### Commit Messages (Conventional Commits)
```
<type>: <short description>

Types: feat, fix, chore, refactor, test, docs, style, perf
Examples:
  feat: add patient vitals history chart
  fix: correct OTP expiration check
  chore: update dependencies
  test: add WebSocket reconnection tests
```

### Before Committing
- [ ] No debug `print()` / `console.log()` statements
- [ ] No commented-out code
- [ ] No placeholder `// TODO` or `// ...` patterns
- [ ] Run: `python -m unittest discover` (backend)
- [ ] Run: `npm run lint && npm test` (web_frontend)
- [ ] Run: `flutter analyze && flutter test` (mobile_app)
- [ ] All new files have header comments
- [ ] All public functions have docstrings

---

## 6. Cross-Cutting Rules

- **Vietnamese UI copy**: Keep user-facing strings in Vietnamese unless the surrounding screen is already English.
- **Alert colors**: Semantically stable — critical red, warning yellow, normal green. Do not change.
- **Dark/Light theme**: New components must work in both themes. Use CSS variables (web) or `Theme.of(context)` (Flutter).
- **No fake medical data**: Never add decorative patient data, invented diagnostic conclusions, or mock medical claims.
- **No GSAP/marketing motion**: Healthcare monitoring app — prioritize clarity over cinematic effects.
