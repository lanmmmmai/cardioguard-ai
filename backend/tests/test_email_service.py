"""Unit tests for services/email_service.py — pure functions (no DB/network).

Run: python -m unittest tests.test_email_service
"""

import os, sys, unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test_db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars")


class TestGetRoleEmailContext(unittest.TestCase):
    """Tests for get_role_email_context."""

    def _call(self, role):
        from app.services.email_service import get_role_email_context
        return get_role_email_context(role)

    def test_patient_role(self):
        ctx = self._call("patient")
        self.assertEqual(ctx["role_label"], "Bệnh nhân")

    def test_doctor_role(self):
        ctx = self._call("doctor")
        self.assertEqual(ctx["role_label"], "Bác sĩ")

    def test_admin_role(self):
        ctx = self._call("admin")
        self.assertEqual(ctx["role_label"], "Quản trị viên")

    def test_vietnamese_role_aliases(self):
        self.assertEqual(self._call("benh_nhan")["role_label"], "Bệnh nhân")
        self.assertEqual(self._call("bac_si")["role_label"], "Bác sĩ")
        self.assertEqual(self._call("quan_tri_vien")["role_label"], "Quản trị viên")

    def test_unknown_role_defaults(self):
        ctx = self._call("unknown")
        self.assertEqual(ctx["role_label"], "Người dùng")

    def test_none_role_defaults(self):
        ctx = self._call(None)
        self.assertEqual(ctx["role_label"], "Người dùng")

    def test_empty_role_defaults(self):
        ctx = self._call("")
        self.assertEqual(ctx["role_label"], "Người dùng")


class TestGetLoginInfo(unittest.TestCase):
    """Tests for get_login_info."""

    def _call(self, role):
        from app.services.email_service import get_login_info
        return get_login_info(role)

    def test_patient_login_url(self):
        info = self._call("patient")
        self.assertIn("/login", info["url"])
        self.assertIn("Bệnh nhân", info["button_text"])

    def test_doctor_login_url(self):
        info = self._call("doctor")
        self.assertIn("/login-doctor", info["url"])

    def test_admin_login_url(self):
        info = self._call("admin")
        self.assertIn("/login-admin", info["url"])

    def test_unknown_role_defaults_to_patient(self):
        info = self._call("unknown")
        self.assertIn("/login", info["url"])


class TestNormalizeEmailType(unittest.TestCase):
    """Tests for normalize_email_type."""

    def _call(self, email_type):
        from app.services.email_service import normalize_email_type
        return normalize_email_type(email_type)

    def test_none_returns_empty(self):
        self.assertEqual(self._call(None), "")

    def test_empty_returns_empty(self):
        self.assertEqual(self._call(""), "")

    def test_alias_password_reset(self):
        self.assertEqual(self._call("password_reset"), "reset_password")

    def test_alias_alert_critical(self):
        self.assertEqual(self._call("alert_critical"), "emergency_alert")

    def test_unknown_type_unchanged(self):
        self.assertEqual(self._call("custom_type"), "custom_type")


class TestNormalizeCmsEmailId(unittest.TestCase):
    """Tests for normalize_cms_email_id."""

    def _call(self, cms_email_id=None, email_type=None):
        from app.services.email_service import normalize_cms_email_id
        return normalize_cms_email_id(cms_email_id, email_type)

    def test_direct_id_returned(self):
        self.assertEqual(self._call("EMAIL_OTP_REGISTER"), "EMAIL_OTP_REGISTER")

    def test_from_catalog(self):
        self.assertEqual(self._call(email_type="otp_register"), "EMAIL_OTP_REGISTER")

    def test_fallback_generated(self):
        result = self._call(email_type="custom_alert")
        self.assertTrue(result.startswith("EMAIL_"))


class TestParseVariables(unittest.TestCase):
    """Tests for parse_variables."""

    def _call(self, raw):
        from app.services.email_service import parse_variables
        return parse_variables(raw)

    def test_none_returns_empty(self):
        self.assertEqual(self._call(None), [])

    def test_list_returns_cleaned(self):
        self.assertEqual(self._call(["a", " b ", ""]), ["a", "b"])

    def test_comma_separated_string(self):
        result = self._call("a, b, c")
        self.assertEqual(result, ["a", "b", "c"])

    def test_newline_separated_string(self):
        result = self._call("a\nb\nc")
        self.assertEqual(result, ["a", "b", "c"])

    def test_json_array_string(self):
        result = self._call('["x", "y"]')
        self.assertEqual(result, ["x", "y"])

    def test_empty_string(self):
        self.assertEqual(self._call(""), [])


class TestExtractPlainText(unittest.TestCase):
    """Tests for extract_plain_text."""

    def _call(self, html):
        from app.services.email_service import extract_plain_text
        return extract_plain_text(html)

    def test_br_to_newline(self):
        self.assertEqual(self._call("Line1<br>Line2"), "Line1\nLine2")

    def test_p_to_double_newline(self):
        self.assertEqual(self._call("<p>Para1</p><p>Para2</p>"), "Para1\n\nPara2")

    def test_strips_remaining_tags(self):
        self.assertEqual(self._call("<b>Bold</b> text"), "Bold text")


class TestRenderTemplate(unittest.TestCase):
    """Tests for render_template."""

    def _call(self, html, variables):
        from app.services.email_service import render_template
        return render_template(html, variables)

    def test_simple_variable_replacement(self):
        result = self._call("Hello {{full_name}}!", {"full_name": "Nguyen Van A"})
        self.assertEqual(result, "Hello Nguyen Van A!")

    def test_otp_and_otp_code_interchangeable(self):
        result = self._call("{{otp}} - {{otp_code}}", {"otp": "123456"})
        self.assertEqual(result, "123456 - 123456")

    def test_new_password_also_fills_otp(self):
        result = self._call("{{otp}}", {"new_password": "NewPass1!"})
        self.assertEqual(result, "NewPass1!")

    def test_default_full_name(self):
        result = self._call("{{full_name}}", {})
        self.assertEqual(result, "Người dùng")

    def test_unknown_variable_unchanged(self):
        result = self._call("{{unknown_var}}", {"known": "val"})
        self.assertEqual(result, "{{unknown_var}}")

    def test_role_label_injected(self):
        result = self._call("{{role_label}}", {"role": "doctor"})
        self.assertEqual(result, "Bác sĩ")

    def test_login_url_injected(self):
        result = self._call("{{login_url}}", {"role": "patient"})
        self.assertIn("/login", result)


class TestResolveTemplateIdentifier(unittest.TestCase):
    """Tests for resolve_template_identifier."""

    def _call(self, email_type=None, cms_email_id=None):
        from app.services.email_service import resolve_template_identifier
        return resolve_template_identifier(email_type, cms_email_id)

    def test_resolves_catalog_type(self):
        canonical_type, canonical_id = self._call(email_type="otp_register")
        self.assertEqual(canonical_id, "EMAIL_OTP_REGISTER")

    def test_passes_through_custom_type(self):
        canonical_type, canonical_id = self._call(email_type="custom_type")
        self.assertEqual(canonical_type, "custom_type")


if __name__ == "__main__":
    unittest.main()
