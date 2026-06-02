---
name: cardioguard-testing-standards
description: Testing standards, frameworks, commands, and patterns for CardioGuard AI across backend (Python unittest), web_frontend (Vitest), and mobile_app (flutter_test).
---

# CardioGuard AI — Testing Standards

## Scope

Use this skill when writing, modifying, or debugging tests in:

- `backend/`: Python `unittest` framework
- `web_frontend/`: Vitest (TypeScript)
- `mobile_app/`: `flutter_test` (Dart)

Also use when asked to "add tests", "write unit tests", "increase coverage", or "verify functionality".

---

## 1. Backend — Python `unittest`

### Test Framework
- Uses Python **built-in `unittest`** (not pytest).
- No pytest/pyproject.toml config exists. Do not install or assume pytest.
- Test files must import `unittest` and extend `unittest.TestCase`.

### Run Tests
```bash
# From backend/ directory:
python -m unittest discover -s tests -p "test_*.py"

# Single test file:
python -m unittest tests.test_core_security

# Single test class / method:
python -m unittest tests.test_core_security.TestPasswordPolicy
python -m unittest tests.test_core_security.TestPasswordPolicy.test_validate_password_accepts_strong_password
```

### File & Naming Conventions
- Location: `backend/tests/`
- Naming: `test_{module_name}.py`
- Class: `Test{ModuleName}` (PascalCase, `unittest.TestCase` subclass)
- Method: `test_{describes_behavior}` (snake_case)

### Required Patterns

#### ENV Setup (top of test file):
```python
import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")
```

#### Standard test structure:
```python
import unittest
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")

from app.core.module import function_under_test


class TestModuleName(unittest.TestCase):
    """Tests for module_name functionality."""

    def test_describes_expected_behavior(self):
        """Short description of what this test verifies."""
        result = function_under_test("valid_input")
        self.assertEqual(result, expected_value)

    def test_handles_edge_case(self):
        """Description of edge case being tested."""
        with self.assertRaises(ValueError):
            function_under_test("invalid_input")
```

### What to Test
- **Core logic**: password policy, token creation/verification, validation functions
- **Security**: auth helpers, RBAC guards, encryption utilities
- **Schemas**: Pydantic model validation
- **Services**: email service, OTP service (with mocked deps)
- **Do NOT test**: external API calls (unless mocked), database queries (unless integration test env is confirmed)

---

## 2. Web Frontend — Vitest

### Test Framework
- Uses **Vitest** (^4.0.7), configured through `vite.config.ts` (no separate vitest.config.ts).
- Syntax: `describe` / `it` / `expect` from `vitest`.

### Run Tests
```bash
# From web_frontend/ directory:
npm test                # vitest run
npx vitest              # watch mode
npx vitest --coverage   # with coverage (if configured)
```

### File & Naming Conventions
- Location: **co-located with source** (e.g. `src/auth/roles.test.ts` next to `roles.ts`)
- Naming: `{filename}.test.ts` or `{filename}.test.tsx`
- Do NOT put tests in a separate `__tests__/` directory.

### Standard Test Structure
```typescript
import { describe, expect, it } from "vitest";
import { functionUnderTest } from "./module";

describe("functionUnderTest", () => {
  it("does what is expected with normal input", () => {
    expect(functionUnderTest("valid")).toBe("expected");
  });

  it("handles edge case gracefully", () => {
    expect(functionUnderTest(null)).toBeNull();
    expect(functionUnderTest("")).toBeNull();
  });
});
```

### What to Test
- **Utility functions**: role normalization, route resolution, password policy helpers
- **Hooks**: WebSocket behaviors, auth state transitions (mock API calls)
- **Components**: render states (loading, empty, error, populated), user interactions
- **Do NOT test**: third-party libraries, build tooling, CSS/styling details

---

## 3. Mobile App — Flutter `flutter_test`

### Test Framework
- Uses **`flutter_test`** (built-in, from SDK).
- Syntax: `test()`, `group()`, `expect()` from `package:flutter_test/flutter_test.dart`.
- Supports `WidgetTester` for widget tests.

### Run Tests
```bash
# From mobile_app/ directory:
flutter test                          # all tests
flutter test test/widget_test.dart    # single file
flutter test --coverage               # with coverage (if lcov is installed)
flutter analyze                       # static analysis (run before tests)
```

### File & Naming Conventions
- Location: `mobile_app/test/`
- Naming: `{description}_test.dart` (snake_case)
- Group: `group("description", () { ... })`
- Test: `test("describes behavior", () { ... })` or `testWidgets("description", (tester) { ... })`

### Standard Test Structure (Unit)
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:heart_monitor_app/config/app_config.dart';

void main() {
  group('AppConfig', () {
    test('exposes valid API and WS endpoints', () {
      expect(AppConfig.baseUrl, startsWith('http'));
      expect(AppConfig.loginEndpoint, '/auth/login');
    });
  });
}
```

### Standard Test Structure (Widget)
```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:heart_monitor_app/providers/auth_provider.dart';

Widget createTestableWidget({required Widget child, required AuthProvider authProvider}) {
  return MediaQuery(
    data: const MediaQueryData(size: Size(400, 800)),
    child: MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
      ],
      child: MaterialApp(home: child),
    ),
  );
}

void main() {
  group('MyWidget', () {
    testWidgets('renders correctly', (tester) async {
      await tester.pumpWidget(createTestableWidget(
        child: const MyWidget(),
        authProvider: AuthProvider(),
      ));
      expect(find.text('Expected Text'), findsOneWidget);
    });
  });
}
```

### What to Test
- **Models**: `fromJson` / `toJson` round-trips, default values, null handling
- **Providers**: state transitions, loading/error/data states (mock API service)
- **Screens/Services**: config values, WebSocket message parsing
- **Widgets**: rendering with `WidgetTester`, user tap/scroll interactions

---

## 4. General Rules (All Modules)

### Before Writing Tests
1. Check existing test files for patterns and style to match.
2. Identify the framework (`unittest`, `vitest`, or `flutter_test`).
3. Understand the module dependencies — mock external calls, test logic in isolation.

### Code Coverage
- Target **core logic modules** first: security, auth, validation, models.
- Do not chase 100% coverage on UI boilerplate or third-party wrappers.
- Run coverage only when explicitly requested.

### Test File Checklist
- [ ] Correct location (per module convention above)
- [ ] Correct naming convention
- [ ] Imports/requires match the module's framework
- [ ] Setup (env vars, mocks) is at the top of the file
- [ ] Tests cover: happy path, edge cases, error states
- [ ] Descriptive test names explain *what* and *why*
- [ ] No hardcoded production secrets or PII in tests
- [ ] Verify with the run command before submitting
