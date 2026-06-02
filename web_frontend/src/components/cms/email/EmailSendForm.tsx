import React, { useEffect, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { API_URL } from '../../../config';
import { useAuth } from '../../../auth/AuthContext';

interface Template {
  id: string;
  cms_email_id: string;
  email_type: string;
  name: string;
  subject: string;
  is_active: boolean;
}

interface EmailSendFormProps {
  onSent?: () => void;
}

export const EmailSendForm: React.FC<EmailSendFormProps> = ({ onSent }) => {
  const { accessToken } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [toEmail, setToEmail] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [variablesJson, setVariablesJson] = useState('{\n  "full_name": "Nguyễn Văn A",\n  "otp": "123456"\n}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load danh sách template
  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_URL}/cms/email-templates?limit=100&is_active=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((d) => setTemplates((d.items || []).filter((t: Template) => t.is_active)))
      .catch(() => {});
  }, [accessToken]);

  // Khi chọn template, tự fill subject
  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setSubject(tpl.subject);
  };

  const parseVariables = (): Record<string, string> | null => {
    try {
      const parsed = JSON.parse(variablesJson);
      setJsonError(null);
      return parsed;
    } catch {
      setJsonError('JSON không hợp lệ');
      return null;
    }
  };

  const handlePreview = async () => {
    const variables = parseVariables();
    if (!variables) return;
    if (!templateId) { setError('Chọn template để preview'); return; }

    setIsPreviewing(true);
    setError(null);
    try {
      // Lấy html_content của template
      const tplRes = await fetch(`${API_URL}/cms/email-templates/${templateId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const tpl = await tplRes.json();

      const res = await fetch(`${API_URL}/email/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ html_content: tpl.html_content, variables }),
      });
      const data = await res.json();
      setPreviewHtml(data.rendered_html || '');
      setShowPreview(true);
    } catch {
      setError('Không thể tải preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSend = async () => {
    const variables = parseVariables();
    if (!variables) return;
    if (!toEmail) { setError('Nhập email người nhận'); return; }

    setError(null);
    setSuccess(null);
    setIsSending(true);
    try {
      const body: Record<string, any> = {
        to_email: toEmail,
        variables,
      };
      if (templateId) body.template_id = templateId;
      if (subject) body.subject = subject;
      if (cc) body.cc = cc;
      if (bcc) body.bcc = bcc;

      const res = await fetch(`${API_URL}/email/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Gửi thất bại');

      setSuccess(`✓ Email đã được gửi đến ${toEmail}`);
      setToEmail('');
      onSent?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="email-send-layout">
      {/* Form */}
      <div className="email-send-form-panel panel">
        <h3 className="email-send-title">Soạn & Gửi Email</h3>
        <p className="email-send-subtitle">Chọn template hoặc nhập nội dung tùy chỉnh</p>

        {error && (
          <div className="alert-strip high" style={{ marginBottom: 16, textAlign: 'left' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-critical)' }}>Lỗi</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        )}
        {success && (
          <div className="alert-strip low" style={{ marginBottom: 16, textAlign: 'left' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-safe)' }}>Thành công</div>
              <div className="alert-strip-desc">{success}</div>
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Chọn Template</label>
          <select
            className="form-control"
            value={templateId}
            onChange={(e) => handleSelectTemplate(e.target.value)}
          >
            <option value="">-- Không dùng template --</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{`${t.name} (${t.cms_email_id})`}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Đến (To) <span style={{ color: 'var(--color-critical)' }}>*</span></label>
          <input
            className="form-control"
            type="email"
            value={toEmail}
            onChange={(e) => setToEmail(e.target.value)}
            placeholder="recipient@example.com"
          />
        </div>

        <div className="email-send-form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>CC</label>
            <input
              className="form-control"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="cc@example.com"
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>BCC</label>
            <input
              className="form-control"
              value={bcc}
              onChange={(e) => setBcc(e.target.value)}
              placeholder="bcc@example.com"
            />
          </div>
        </div>

        <div className="form-group">
          <label>Subject (bỏ trống để dùng subject của template)</label>
          <input
            className="form-control"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Tiêu đề email..."
          />
        </div>

        <div className="form-group">
          <label>
            Biến động (JSON)
            {jsonError && <span style={{ color: 'var(--color-critical)', marginLeft: 8, fontSize: 12 }}>{jsonError}</span>}
          </label>
          <textarea
            className={`form-control email-variables-json ${jsonError ? 'error' : ''}`}
            rows={6}
            value={variablesJson}
            onChange={(e) => { setVariablesJson(e.target.value); parseVariables(); }}
            spellCheck={false}
          />
          <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            Nhập các giá trị để thay thế vào template. VD: {`{"full_name": "Nguyễn Văn A", "otp": "654321"}`}
          </small>
        </div>

        <div className="email-send-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={isPreviewing || !templateId}
          >
            {isPreviewing ? <Loader2 size={15} className="beat-animated" /> : null}
            Xem trước
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSend}
            disabled={isSending}
            style={{ minWidth: 120 }}
          >
            {isSending
              ? <><Loader2 size={15} className="beat-animated" /> Đang gửi...</>
              : <><Send size={15} /> Gửi ngay</>}
          </button>
        </div>
      </div>

      {/* Preview panel */}
      {showPreview && (
        <div className="email-send-preview-panel panel">
          <div className="email-preview-toolbar">
            <span className="email-preview-label">Preview trước khi gửi</span>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={() => setShowPreview(false)}
            >
              Đóng
            </button>
          </div>
          <iframe
            className="email-preview-iframe"
            style={{ height: 500 }}
            title="Send Preview"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;background:#f9fafb;padding:20px;font-family:sans-serif}</style></head><body>${previewHtml}</body></html>`}
            sandbox="allow-same-origin"
          />
        </div>
      )}
    </div>
  );
};
