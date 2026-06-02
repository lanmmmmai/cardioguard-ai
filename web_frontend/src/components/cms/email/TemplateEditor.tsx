import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Monitor, Save, Smartphone, X } from 'lucide-react';
import { API_URL } from '../../../config';
import { useAuth } from '../../../auth/AuthContext';
import { EmailVariables } from './EmailVariables';
import {
  EMAIL_TEMPLATE_OPTIONS,
  normalizeCmsEmailId,
  parseVariablesList,
  suggestCmsEmailId,
} from './emailTemplateCatalog';

interface Template {
  id?: string;
  cms_email_id?: string;
  email_type: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  variables: string[];
  is_active: boolean;
}

interface TemplateEditorProps {
  template: Template | null;  // null = tạo mới
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}

export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onClose, onSaved, readOnly = false }) => {
  const { accessToken } = useAuth();
  const [form, setForm] = useState<Template>({
    id: template?.id,
    cms_email_id: template?.cms_email_id ?? '',
    email_type: template?.email_type ?? EMAIL_TEMPLATE_OPTIONS[0].value,
    name: template?.name ?? '',
    subject: template?.subject ?? '',
    html_content: template?.id ? '' : DEFAULT_HTML,
    text_content: template?.text_content ?? '',
    variables: template?.variables ?? ['full_name', 'otp'],
    is_active: template?.is_active ?? true,
  });
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewHtml, setPreviewHtml] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadTemplateDetail = async () => {
      // Tạo mới template
      if (!template?.id) {
        const newForm: Template = {
          cms_email_id: suggestCmsEmailId(EMAIL_TEMPLATE_OPTIONS[0].value),
          email_type: EMAIL_TEMPLATE_OPTIONS[0].value,
          name: '',
          subject: '',
          html_content: DEFAULT_HTML,
          text_content: '',
          variables: ['full_name', 'otp'],
          is_active: true,
        };

        setForm(newForm);
        setPreviewHtml(DEFAULT_HTML);
        return;
      }

      // Chỉnh sửa template cũ
      setIsLoadingTemplate(true);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/cms/email-templates/${template.id}`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || 'Không thể tải chi tiết template');
        }

        const nextForm: Template = {
          id: data.id,
          cms_email_id: data.cms_email_id || '',
          email_type: data.email_type || data.type || EMAIL_TEMPLATE_OPTIONS[0].value,
          name: data.name || '',
          subject: data.subject || '',
          html_content: data.html_content || '',
          text_content: data.text_content || '',
          variables: Array.isArray(data.variables) ? data.variables : parseVariablesList(data.variables || ''),
          is_active: data.is_active ?? true,
        };

        setForm(nextForm);
        setPreviewHtml(nextForm.html_content);
      } catch (err: any) {
        setError(err.message || 'Không thể tải template');
      } finally {
        setIsLoadingTemplate(false);
      }
    };

    loadTemplateDetail();
  }, [template?.id, accessToken]);

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

  const handleEmailTypeChange = (emailType: string) => {
    setForm((prev) => {
      const nextCmsEmailId = prev.cms_email_id && prev.cms_email_id !== suggestCmsEmailId(prev.email_type)
        ? prev.cms_email_id
        : suggestCmsEmailId(emailType);
      return {
        ...prev,
        email_type: emailType,
        cms_email_id: normalizeCmsEmailId(nextCmsEmailId || suggestCmsEmailId(emailType)),
      };
    });
  };

  const handleInsertVariable = (syntax: string) => {
    if (readOnly) return;
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
    if (readOnly) return;
    if (!form.cms_email_id?.trim()) { setError('Mã ID Email CMS không được trống'); return; }
    if (!form.email_type) { setError('Chức năng gửi mail không được trống'); return; }
    if (!form.name.trim()) { setError('Tên template không được trống'); return; }
    if (!form.subject.trim()) { setError('Subject không được trống'); return; }
    if (!form.html_content.trim()) { setError('Nội dung HTML không được trống'); return; }

    setError(null);
    setIsSaving(true);
    try {
      const url = template?.id
        ? `${API_URL}/cms/email-templates/${template.id}`
        : `${API_URL}/cms/email-templates`;
      const method = template?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...form,
          cms_email_id: normalizeCmsEmailId(form.cms_email_id || ''),
          variables: form.variables,
        }),
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
              {template?.id ? (readOnly ? 'Xem template' : 'Chỉnh sửa template') : 'Tạo template mới'}
            </h2>
            <p className="email-editor-subtitle">Chỉnh sửa nội dung và xem preview real-time</p>
          </div>
          <div className="email-editor-header-actions">
            <button
              type="button"
              className={`btn btn-secondary ${showVariables ? 'active' : ''}`}
              onClick={() => setShowVariables((v) => !v)}
              disabled={readOnly}
            >
              {showVariables ? <EyeOff size={15} /> : <Eye size={15} />}
              {showVariables ? 'Ẩn biến' : 'Biến động'}
            </button>
            {!readOnly && (
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
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
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
              <label>Mã ID Email CMS <span style={{ color: 'var(--color-critical)' }}>*</span></label>
              <input
                className="form-control"
                value={form.cms_email_id || ''}
                onChange={(e) => set('cms_email_id', normalizeCmsEmailId(e.target.value))}
                placeholder="EMAIL_OTP_REGISTER"
                disabled={isLoadingTemplate || readOnly}
              />
            </div>

            <div className="form-group">
              <label>Tên template <span style={{ color: 'var(--color-critical)' }}>*</span></label>
              <input
                className="form-control"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="VD: OTP Đăng Ký Tài Khoản"
                disabled={readOnly}
              />
            </div>

            <div className="form-group">
              <label>Email Subject <span style={{ color: 'var(--color-critical)' }}>*</span></label>
              <input
                className="form-control"
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                placeholder="VD: CardioGuard AI - Mã OTP của bạn"
                disabled={readOnly}
              />
            </div>

            <div className="email-editor-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Chức năng gửi mail <span style={{ color: 'var(--color-critical)' }}>*</span></label>
                <select
                  className="form-control"
                  value={form.email_type}
                  onChange={(e) => handleEmailTypeChange(e.target.value)}
                  disabled={readOnly}
                >
                  {EMAIL_TEMPLATE_OPTIONS.map((t) => (
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
                    disabled={readOnly}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-safe)' }}
                  />
                  Kích hoạt
                </label>
              </div>
            </div>

            <div className="form-group">
              <label>Biến hỗ trợ</label>
              <textarea
                className="form-control"
                rows={3}
                value={form.variables.join('\n')}
                onChange={(e) => set('variables', parseVariablesList(e.target.value))}
                placeholder="{{full_name}}\n{{otp}}\n{{current_date}}"
                disabled={readOnly}
              />
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
                placeholder={isLoadingTemplate ? 'Đang tải template...' : 'Nhập HTML hoặc dùng biến động {{full_name}}, {{otp}}...'}
                spellCheck={false}
                disabled={isLoadingTemplate || readOnly}
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
                disabled={readOnly}
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
