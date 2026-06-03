/**
 * Mục đích: Trình chỉnh sửa template email HTML toàn màn hình với xem trước trực tiếp và chèn biến động.
 * Luồng xử lý: Tải chi tiết template hiện có từ API khi khởi tạo (hoặc sử dụng HTML mặc định cho template mới);
 *              cung cấp bố cục chia đôi: bên trái cho các trường biểu mẫu/trình soạn thảo HTML, bên phải cho
 *              xem trước trực tiếp với nút chuyển đổi desktop/mobile. Hỗ trợ chèn {{variables}} tại vị trí con trỏ.
 *              Tự động lưu qua xem trước trực tiếp có debounce (400ms).
 * Quan hệ: Được sử dụng bởi EmailCmsPage; ủy quyền cho EmailVariables cho bảng điều khiển biến động;
 *          Gọi /email/templates/:id để lấy chi tiết, PUT/POST để lưu.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Loader2, Monitor, Save, Smartphone, X } from 'lucide-react';
import { API_URL } from '../../../config';
import { useAuth } from '../../../auth/AuthContext';
import { EmailVariables } from './EmailVariables';
import {
  CUSTOM_TEMPLATE_HINTS,
  type EmailFunctionOption,
  EMAIL_GROUP_LABEL_MAP,
  EMAIL_TARGET_ROLE_LABEL_MAP,
  SYSTEM_EMAIL_FUNCTIONS,
  normalizeCmsEmailId,
  normalizeEmailType,
  parseVariablesList,
  suggestCmsEmailId,
} from './emailTemplateCatalog';

interface Template {
  id?: string;
  function_id?: string;
  cms_email_id?: string;
  email_type: string;
  target_role?: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  variables: string[];
  is_active: boolean;
}

type CustomFunctionDraft = {
  email_type: string;
  cms_email_id: string;
  name: string;
  group_key: string;
  target_role: string;
  description: string;
  required_variables: string[];
  optional_variables: string[];
};

type PersistedEmailFunction = EmailFunctionOption & {
  id: string;
};

interface TemplateEditorProps {
  template: Template | null;  // null = tạo mới
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean;
}

/**
 * Component TemplateEditor — hộp thoại chỉnh sửa template email toàn màn hình với xem trước trực tiếp,
 * chèn biến động và nút chuyển đổi responsive desktop/mobile.
 */
export const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onClose, onSaved, readOnly = false }) => {
  const { accessToken } = useAuth();
  const buildFallbackForm = (): Template => ({
    id: template?.id,
    function_id: template?.function_id,
    cms_email_id: template?.cms_email_id ?? '',
    email_type: template?.email_type ?? SYSTEM_EMAIL_FUNCTIONS[0].email_type,
    target_role: template?.target_role ?? 'all',
    name: template?.name ?? '',
    subject: template?.subject ?? '',
    html_content: template?.html_content ?? DEFAULT_HTML,
    text_content: template?.text_content ?? '',
    variables: template?.variables ?? ['full_name', 'otp'],
    is_active: template?.is_active ?? true,
  });
  const [form, setForm] = useState<Template>({
    ...buildFallbackForm(),
    html_content: template?.id ? (template?.html_content ?? DEFAULT_HTML) : DEFAULT_HTML,
  });
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customFunctions, setCustomFunctions] = useState<PersistedEmailFunction[]>([]);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [draftFunction, setDraftFunction] = useState<CustomFunctionDraft>({
    email_type: '',
    cms_email_id: '',
    name: '',
    group_key: 'custom',
    target_role: 'doctor',
    description: '',
    required_variables: [],
    optional_variables: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [showVariables, setShowVariables] = useState(false);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewHtml, setPreviewHtml] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadTemplateDetail = async () => {
      try {
        const fnRes = await fetch(`${API_URL}/cms/email-functions`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const fnData = await fnRes.json();
        if (fnRes.ok) {
          setCustomFunctions((fnData.items || []).filter((item: any) => !item.is_system));
        }
      } catch {
        // ignore function list load failures; editor can still work with system options
      }

      // Tạo mới template
      if (!template?.id) {
        const newForm: Template = {
          cms_email_id: suggestCmsEmailId(SYSTEM_EMAIL_FUNCTIONS[0].email_type),
          email_type: SYSTEM_EMAIL_FUNCTIONS[0].email_type,
          target_role: SYSTEM_EMAIL_FUNCTIONS[0].target_role,
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

        if (!res.ok) {
          const fallbackForm = buildFallbackForm();
          setForm(fallbackForm);
          setPreviewHtml(fallbackForm.html_content);
          return;
        }

        const data = await res.json();
        if (!data || typeof data !== 'object') {
          const fallbackForm = buildFallbackForm();
          setForm(fallbackForm);
          setPreviewHtml(fallbackForm.html_content);
          return;
        }

        const nextForm: Template = {
          id: data.id ?? template.id,
          function_id: data.function_id,
          cms_email_id: data.cms_email_id || '',
          email_type: data.email_type || data.type || SYSTEM_EMAIL_FUNCTIONS[0].email_type,
          target_role: data.target_role || 'all',
          name: data.name || '',
          subject: data.subject || '',
          html_content: data.html_content || '',
          text_content: data.text_content || '',
          variables: Array.isArray(data.variables) ? data.variables : parseVariablesList(data.variables || ''),
          is_active: data.is_active ?? true,
        };

        setForm(nextForm);
        setPreviewHtml(nextForm.html_content);
        if (data.function_id || (!SYSTEM_EMAIL_FUNCTIONS.some((item) => item.email_type === nextForm.email_type) && nextForm.email_type)) {
          setShowCustomForm(true);
          setDraftFunction({
            email_type: normalizeEmailType(data.email_type || ''),
            cms_email_id: normalizeCmsEmailId(data.cms_email_id || ''),
            name: data.name || '',
            group_key: data.group_key || 'custom',
            target_role: data.target_role || 'all',
            description: data.description || '',
            required_variables: Array.isArray(data.required_variables) ? data.required_variables : [],
            optional_variables: Array.isArray(data.optional_variables) ? data.optional_variables : [],
          });
        }
      } catch (err: any) {
        const fallbackForm = buildFallbackForm();
        setForm(fallbackForm);
        setPreviewHtml(fallbackForm.html_content);
        setError(null);
        console.warn('Không thể tải chi tiết template, dùng dữ liệu hiện có:', err);
      } finally {
        setIsLoadingTemplate(false);
      }
    };

    loadTemplateDetail();
  }, [template?.id, accessToken]);

  // Xem trước trực tiếp: debounce 400ms
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
    if (emailType === '__custom__') {
      setShowCustomForm(true);
      setForm((prev) => ({ ...prev, email_type: '', cms_email_id: '', function_id: undefined }));
      return;
    }
    setShowCustomForm(false);
    const selected = SYSTEM_EMAIL_FUNCTIONS.find((item) => item.email_type === emailType) || customFunctions.find((item) => item.email_type === emailType);
    setForm((prev) => {
      const nextCmsEmailId = prev.cms_email_id && prev.cms_email_id !== suggestCmsEmailId(prev.email_type)
        ? prev.cms_email_id
        : (selected?.cms_email_id || suggestCmsEmailId(emailType));
      return {
        ...prev,
        email_type: emailType,
        target_role: selected?.target_role || prev.target_role || 'all',
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
    // Khôi phục vị trí con trỏ
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
    if (showCustomForm) {
      if (!draftFunction.email_type.trim()) { setError('email_type của chức năng tùy chỉnh không được trống'); return; }
      if (!draftFunction.cms_email_id.trim()) { setError('Mã ID Email CMS của chức năng tùy chỉnh không được trống'); return; }
      if (!draftFunction.name.trim()) { setError('Tên loại template không được trống'); return; }
    }

    setError(null);
    setIsSaving(true);
    try {
      const resolvedTemplateId = form.id || template?.id || null;
      let functionId = form.function_id;
      let emailType = form.email_type;
      let cmsEmailId = normalizeCmsEmailId(form.cms_email_id || '');

      if (showCustomForm) {
        const functionPayload = {
          email_type: normalizeEmailType(draftFunction.email_type),
          cms_email_id: normalizeCmsEmailId(draftFunction.cms_email_id),
          name: draftFunction.name,
          group_key: draftFunction.group_key || 'custom',
          target_role: draftFunction.target_role || 'all',
          description: draftFunction.description,
          required_variables: draftFunction.required_variables,
          optional_variables: draftFunction.optional_variables,
          is_system: false,
          is_active: true,
        };
        const fnRes = await fetch(`${API_URL}/cms/email-functions${form.function_id ? `/${form.function_id}` : ''}`, {
          method: form.function_id ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(functionPayload),
        });
        const fnData = await fnRes.json();
        if (!fnRes.ok) {
          if (fnRes.status === 409 && !form.function_id) {
            try {
              const lookupRes = await fetch(
                `${API_URL}/cms/email-functions?q=${encodeURIComponent(functionPayload.email_type)}&is_active=true`,
                {
                  headers: { Authorization: `Bearer ${accessToken}` },
                }
              );
              const lookupData = await lookupRes.json();
              const matchedFunction = (Array.isArray(lookupData.items) ? lookupData.items : [])
                .find((item: any) =>
                  item.email_type === functionPayload.email_type ||
                  item.cms_email_id === functionPayload.cms_email_id
                );
              if (matchedFunction?.id) {
                functionId = matchedFunction.id;
                emailType = matchedFunction.email_type;
                cmsEmailId = matchedFunction.cms_email_id;
                setForm((prev) => ({
                  ...prev,
                  function_id: matchedFunction.id,
                  email_type: matchedFunction.email_type,
                  cms_email_id: matchedFunction.cms_email_id,
                }));
              } else {
                throw new Error(fnData.detail || 'Loại template tùy chỉnh đã tồn tại');
              }
            } catch {
              throw new Error(fnData.detail || 'Loại template tùy chỉnh đã tồn tại');
            }
          } else {
            throw new Error(fnData.detail || 'Không thể lưu loại template tùy chỉnh');
          }
        } else {
          functionId = fnData.id;
          emailType = fnData.email_type;
          cmsEmailId = fnData.cms_email_id;
          setForm((prev) => ({
            ...prev,
            function_id: fnData.id,
            email_type: fnData.email_type || prev.email_type,
            cms_email_id: fnData.cms_email_id || prev.cms_email_id,
          }));
        }
      }

      const url = resolvedTemplateId
        ? `${API_URL}/cms/email-templates/${resolvedTemplateId}`
        : `${API_URL}/cms/email-templates`;
      const method = resolvedTemplateId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          ...form,
          function_id: functionId,
          email_type: emailType,
          cms_email_id: cmsEmailId,
          target_role: form.target_role || 'all',
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
        {/* Tiêu đề */}
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

        {/* Nội dung */}
        <div className="email-editor-body">
          {/* BÊN TRÁI: Biểu mẫu cấu hình */}
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
                <label>Loại template <span style={{ color: 'var(--color-critical)' }}>*</span></label>
                <select
                  className="form-control"
                  value={showCustomForm ? '__custom__' : form.email_type}
                  onChange={(e) => handleEmailTypeChange(e.target.value)}
                  disabled={readOnly}
                >
                  <optgroup label="Nhóm hệ thống">
                    {SYSTEM_EMAIL_FUNCTIONS.map((t) => (
                      <option key={t.email_type} value={t.email_type}>{t.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Nhóm tùy chỉnh">
                    {customFunctions.map((t) => (
                      <option key={t.email_type} value={t.email_type}>{t.name}</option>
                    ))}
                    <option value="__custom__">Tùy chỉnh...</option>
                  </optgroup>
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

            {showCustomForm && (
              <div className="panel" style={{ marginBottom: 16, padding: 16 }}>
                <h4 style={{ marginTop: 0 }}>Tạo loại template tùy chỉnh</h4>
                <div className="cms-form-grid">
                  <div className="form-group">
                    <label>Mã chức năng gửi mail *</label>
                    <input
                      className="form-control"
                      value={draftFunction.email_type}
                      onChange={(e) => setDraftFunction((prev) => ({
                        ...prev,
                        email_type: normalizeEmailType(e.target.value),
                        cms_email_id: prev.cms_email_id || suggestCmsEmailId(normalizeEmailType(e.target.value)),
                      }))}
                      placeholder="doctor_profile_require_update"
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Mã ID Email CMS *</label>
                    <input
                      className="form-control"
                      value={draftFunction.cms_email_id}
                      onChange={(e) => setDraftFunction((prev) => ({ ...prev, cms_email_id: normalizeCmsEmailId(e.target.value) }))}
                      placeholder="EMAIL_DOCTOR_PROFILE_REQUIRE_UPDATE"
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tên loại template *</label>
                    <input
                      className="form-control"
                      value={draftFunction.name}
                      onChange={(e) => setDraftFunction((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Bác sĩ cần bổ sung hồ sơ"
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Nhóm chức năng</label>
                    <select
                      className="form-control"
                      value={draftFunction.group_key}
                      onChange={(e) => setDraftFunction((prev) => ({ ...prev, group_key: e.target.value }))}
                      disabled={readOnly}
                    >
                      {Object.entries(EMAIL_GROUP_LABEL_MAP).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Vai trò người nhận</label>
                    <select
                      className="form-control"
                      value={draftFunction.target_role}
                      onChange={(e) => setDraftFunction((prev) => ({ ...prev, target_role: e.target.value }))}
                      disabled={readOnly}
                    >
                      {Object.entries(EMAIL_TARGET_ROLE_LABEL_MAP).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Mô tả chức năng</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={draftFunction.description}
                      onChange={(e) => setDraftFunction((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Mô tả khi nào backend sẽ gửi email này"
                      disabled={readOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Biến hỗ trợ</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={draftFunction.required_variables.concat(draftFunction.optional_variables).join('\n')}
                      onChange={(e) => {
                        const items = parseVariablesList(e.target.value);
                        setDraftFunction((prev) => ({ ...prev, required_variables: items.slice(0, 4), optional_variables: items.slice(4) }));
                      }}
                      placeholder="{{full_name}}\n{{verification_note}}\n{{update_profile_url}}\n{{support_email}}"
                      disabled={readOnly}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}>
                  {CUSTOM_TEMPLATE_HINTS.join(' • ')}
                </div>
              </div>
            )}

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

          {/* BÊN PHẢI: Xem trước trực tiếp */}
          <div className="email-editor-right">
            <div className="email-preview-toolbar">
              <span className="email-preview-label">Xem trước trực tiếp</span>
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
                title="Xem trước Email"
                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#f9fafb;padding:20px;font-family:sans-serif}</style></head><body>${previewHtml}</body></html>`}
                sandbox="allow-same-origin allow-scripts"
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
