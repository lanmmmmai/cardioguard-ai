import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Monitor, Save, Smartphone, X } from 'lucide-react';
import { API_URL } from '../../../config';
import { useAuth } from '../../../auth/AuthContext';
import { EmailVariables } from './EmailVariables';

const TEMPLATE_TYPES = [
  { value: 'otp_register',        label: 'OTP Đăng ký' },
  { value: 'otp_login',           label: 'OTP Đăng nhập' },
  { value: 'welcome',             label: 'Welcome Email' },
  { value: 'password_reset',      label: 'Đặt lại mật khẩu' },
  { value: 'alert_critical',      label: 'Cảnh báo khẩn cấp' },
  { value: 'appointment_reminder',label: 'Nhắc lịch hẹn' },
  { value: 'doctor_assigned',     label: 'Phân công bác sĩ' },
  { value: 'health_warning',      label: 'Cảnh báo sức khỏe' },
  { value: 'monthly_report',      label: 'Báo cáo tháng' },
  { value: 'custom',              label: 'Tùy chỉnh' },
];

interface Template {
  id?: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  type: string;
  is_active: boolean;
}

interface TemplateEditorProps {
  template: Template | null;  // null = tạo mới
  onClose: () => void;
  onSaved: () => void;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onClose, onSaved }) => {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<Template>({
    name: template?.name ?? '',
    subject: template?.subject ?? '',
    html_content: template?.html_content ?? DEFAULT_HTML,
    text_content: template?.text_content ?? '',
    type: template?.type ?? 'custom',
    is_active: template?.is_active ?? true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewHtml, setPreviewHtml] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live preview: debounce 400ms
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      setPreviewHtml(form.html_content);
    }, 400);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [form.html_content]);

  const set = (field: keyof Template, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleInsertVariable = (syntax: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newValue = form.html_content.slice(0, start) + syntax + form.html_content.slice(end);
    set('html_content', newValue);
    // Restore caret position
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + syntax.length;
      ta.focus();
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Tên template không được trống'); return; }
    if (!form.subject.trim()) { setError('Subject không được trống'); return; }

    setError(null);
    setIsSaving(true);
    try {
      const url = template?.id
        ? `${API_URL}/email/templates/${template.id}`
        : `${API_URL}/email/templates`;
      const method = template?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lưu thất bại');
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="email-editor-overlay">
      <div className="email-editor-modal">
        {/* Header */}
        <div className="email-editor-header">
          <div>
            <h2 className="email-editor-title">
              {template?.id ? 'Chỉnh sửa template' : 'Tạo template mới'}
            </h2>
            <p className="email-editor-subtitle">Chỉnh sửa nội dung và xem preview real-time</p>
          </div>
          <div className="email-editor-header-actions">
            <button
              type="button"
              className={`btn btn-secondary ${showVariables ? 'active' : ''}`}
              onClick={() => setShowVariables((v) => !v)}
            >
              {showVariables ? <EyeOff size={15} /> : <Eye size={15} />}
              {showVariables ? 'Ẩn biến' : 'Biến động'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? <><Loader2 size={15} className="beat-animated" /> Đang lưu...</>
                : <><Save size={15} /> Lưu template</>}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <X size={15} />
            </button>
          </div>
        </div>

        {error && (
          <div className="alert-strip high" style={{ margin: '0 24px 0', textAlign: 'left' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-critical)' }}>Lỗi</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="email-editor-body">
          {/* LEFT: Config form */}
          <div className="email-editor-left">
            {showVariables && (
              <div className="email-editor-variables-drawer">
                <EmailVariables onInsert={handleInsertVariable} />
              </div>
            )}

            <div className="form-group">
              <label>Tên template <span style={{ color: 'var(--color-critical)' }}>*</span></label>
              <input
                className="form-control"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="VD: OTP Đăng Ký Tài Khoản"
              />
            </div>

            <div className="form-group">
              <label>Email Subject <span style={{ color: 'var(--color-critical)' }}>*</span></label>
              <input
                className="form-control"
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                placeholder="VD: CardioGuard AI - Mã OTP của bạn"
              />
            </div>

            <div className="email-editor-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Loại template</label>
                <select
                  className="form-control"
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                >
                  {TEMPLATE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
                <label className="email-editor-toggle-label">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => set('is_active', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-safe)' }}
                  />
                  Kích hoạt
                </label>
              </div>
            </div>

            <div className="form-group" style={{ flex: 1 }}>
              <div className="email-editor-textarea-header">
                <label>Nội dung HTML <span style={{ color: 'var(--color-critical)' }}>*</span></label>
                <span className="email-editor-char-count">{form.html_content.length} ký tự</span>
              </div>
              <textarea
                ref={textareaRef}
                className="form-control email-editor-html-textarea"
                value={form.html_content}
                onChange={(e) => set('html_content', e.target.value)}
                placeholder="Nhập HTML hoặc dùng biến động {{full_name}}, {{otp}}..."
                spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label>Nội dung text thuần (tuỳ chọn)</label>
              <textarea
                className="form-control"
                rows={3}
                value={form.text_content}
                onChange={(e) => set('text_content', e.target.value)}
                placeholder="Phiên bản text để hiển thị khi email client không hỗ trợ HTML..."
              />
            </div>
          </div>

          {/* RIGHT: Live preview */}
          <div className="email-editor-right">
            <div className="email-preview-toolbar">
              <span className="email-preview-label">Live Preview</span>
              <div className="email-preview-mode-btns">
                <button
                  type="button"
                  className={`email-preview-mode-btn ${previewMode === 'desktop' ? 'active' : ''}`}
                  onClick={() => setPreviewMode('desktop')}
                  title="Desktop"
                >
                  <Monitor size={15} />
                </button>
                <button
                  type="button"
                  className={`email-preview-mode-btn ${previewMode === 'mobile' ? 'active' : ''}`}
                  onClick={() => setPreviewMode('mobile')}
                  title="Mobile"
                >
                  <Smartphone size={15} />
                </button>
              </div>
            </div>
            <div className={`email-preview-frame-wrap ${previewMode}`}>
              <iframe
                className="email-preview-iframe"
                title="Email Preview"
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f9fafb;padding:20px;font-family:sans-serif}</style></head><body>${previewHtml}</body></html>`}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DEFAULT_HTML = `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px;border:1px solid #e2e8f0;border-radius:12px;background:#fff">
  <h2 style="color:#e11d48;margin-bottom:8px">CardioGuard AI</h2>
  <p style="color:#374151">Xin chào <strong>{{full_name}}</strong>,</p>
  <p style="color:#374151">Nội dung email của bạn ở đây...</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
  <p style="color:#9ca3af;font-size:12px">{{hospital_name}} — {{current_date}}</p>
</div>`;
