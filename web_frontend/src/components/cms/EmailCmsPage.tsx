import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Edit2, Eye, FileText, History,
  Loader2, Mail, Plus, RefreshCw, Search,
  Send, Trash2, ToggleLeft, ToggleRight, Variable,
} from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../auth/AuthContext';
import { TemplateEditor } from './email/TemplateEditor';
import { EmailSendForm } from './email/EmailSendForm';
import { EmailLogsTable } from './email/EmailLogsTable';
import { EmailVariables } from './email/EmailVariables';
import { EMAIL_TEMPLATE_LABEL_MAP } from './email/emailTemplateCatalog';

// ───────────────────────────────────────────────────────────
// Tabs
// ───────────────────────────────────────────────────────────
type TabKey = 'templates' | 'send' | 'variables' | 'logs';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'templates', label: 'Danh sách template', icon: <FileText size={15} /> },
  { key: 'send',      label: 'Soạn & Gửi',         icon: <Send size={15} /> },
  { key: 'variables', label: 'Biến động',            icon: <Variable size={15} /> },
  { key: 'logs',      label: 'Lịch sử gửi',          icon: <History size={15} /> },
];

interface Template {
  id: string;
  cms_email_id: string;
  email_type: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailCmsPageProps {
  embedded?: boolean;
}

export const EmailCmsPage: React.FC<EmailCmsPageProps> = ({ embedded = false }) => {
  const { accessToken, role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('templates');

  // Templates state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [logRefreshSignal, setLogRefreshSignal] = useState(0);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<Template | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);

  const LIMIT = 15;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // ──────────────────────────────
  // Fetch templates
  // ──────────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (q) params.set('q', q);
      const res = await fetch(`${API_URL}/cms/email-templates?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Lỗi tải templates');
      setTemplates(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, q, offset]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { setOffset(0); }, [q]);

  // ──────────────────────────────
  // Actions
  // ──────────────────────────────
  const handleView = (tpl: Template) => {
    setEditorTemplate(tpl);
    setEditorReadOnly(true);
    setShowEditor(true);
  };

  const handleEdit = (tpl: Template) => {
    setEditorTemplate(tpl);
    setEditorReadOnly(false);
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditorTemplate(null);
    setEditorReadOnly(false);
    setShowEditor(true);
  };

  const handleEditorSaved = () => {
    setShowEditor(false);
    fetchTemplates();
    showToast('✓ Template đã được lưu thành công');
  };

  const handleToggle = async (tpl: Template) => {
    try {
      const res = await fetch(`${API_URL}/cms/email-templates/${tpl.id}/activate?active=${!tpl.is_active}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setTemplates((prev) =>
        prev.map((t) => t.id === tpl.id ? { ...t, is_active: data.is_active } : t)
      );
      showToast(`${data.is_active ? '✓ Đã kích hoạt' : '○ Đã tắt'} template "${tpl.name}"`);
    } catch (err: any) {
      showToast(`✗ ${err.message}`);
    }
  };

  const handleDelete = async (tpl: Template) => {
    if (!window.confirm(`Xóa template "${tpl.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      const res = await fetch(`${API_URL}/cms/email-templates/${tpl.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Xóa thất bại');
      await fetchTemplates();
      showToast(`✓ Đã xóa template "${tpl.name}"`);
    } catch (err: any) {
      showToast(`✗ ${err.message}`);
    }
  };

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const page = Math.floor(offset / LIMIT) + 1;

  if (role !== 'admin') {
    return <div className="panel cms-empty-state">Bạn không có quyền truy cập Email CMS.</div>;
  }

  return (
    <div className="email-cms-page">
      {toast && <div className="cms-toast">{toast}</div>}

      {/* Page Header */}
      {!embedded && (
        <div className="page-header cms-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Mail size={22} style={{ color: 'var(--color-primary)' }} />
              Email CMS
            </h1>
            <p className="page-subtitle">Quản lý mẫu email, gửi thông báo và theo dõi lịch sử gửi.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeTab === 'templates' && (
              <>
                <button className="btn btn-secondary" type="button" onClick={fetchTemplates}>
                  <RefreshCw size={14} /> Làm mới
                </button>
                <button className="btn btn-primary" type="button" onClick={handleNew}>
                  <Plus size={14} /> Thêm mẫu email
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="email-cms-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`email-cms-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Templates list ─── */}
      {activeTab === 'templates' && (
        <div className="panel email-cms-panel">
          {/* Filters */}
          <div className="email-templates-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <label className="email-logs-search-wrap" style={{ flex: 1, minWidth: '200px' }}>
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                className="email-logs-search"
                placeholder="Tìm tên template, subject..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="email-templates-count">{total} templates</span>
              {embedded && (
                <>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={fetchTemplates} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={14} /> Làm mới
                  </button>
                  <button className="btn btn-primary btn-sm" type="button" onClick={handleNew} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> Thêm mẫu email
                  </button>
                </>
              )}
            </div>
          </div>

          {error && <div className="cms-inline-error">{error}</div>}

          {/* Table */}
          <div className="email-logs-table-wrap">
            <table className="email-logs-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Mã ID Email CMS</th>
                  <th>Tên mẫu email</th>
                  <th>Chức năng gửi mail</th>
                  <th>Tiêu đề</th>
                  <th>Trạng thái</th>
                  <th>Ngày cập nhật</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px' }}>
                      <Loader2 className="beat-animated" size={20} style={{ margin: 'auto', display: 'block' }} />
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="email-logs-empty">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Mail size={32} style={{ opacity: 0.3 }} />
                        <span>Chưa có template nào. Tạo template đầu tiên!</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  templates.map((tpl, index) => (
                    <tr key={tpl.id} className="email-logs-row">
                      <td className="email-logs-cell">{offset + index + 1}</td>
                      <td className="email-logs-cell">
                        <div className="template-name-main">{tpl.cms_email_id}</div>
                      </td>
                      <td className="email-logs-cell">
                        <div className="template-name-main">{tpl.name}</div>
                      </td>
                      <td className="email-logs-cell">
                        <span className="email-type-badge">{EMAIL_TEMPLATE_LABEL_MAP[tpl.email_type] || tpl.email_type}</span>
                      </td>
                      <td className="email-logs-cell subject-cell" title={tpl.subject}>
                        {tpl.subject.length > 50 ? `${tpl.subject.slice(0, 50)}...` : tpl.subject}
                      </td>
                      <td className="email-logs-cell">
                        <span
                          className="email-status-badge"
                          style={{ color: tpl.is_active ? 'var(--color-safe)' : 'var(--text-muted)' }}
                        >
                          {tpl.is_active ? <><CheckCircle2 size={13} /> Hoạt động</> : '○ Tắt'}
                        </span>
                      </td>
                      <td className="email-logs-cell muted-cell">{formatDate(tpl.updated_at)}</td>
                      <td className="email-logs-cell">
                        <div className="email-template-actions">
                          <button
                            type="button"
                            className="email-action-btn"
                            onClick={() => handleView(tpl)}
                            title="Xem"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="email-action-btn"
                            onClick={() => handleEdit(tpl)}
                            title="Sửa"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="email-action-btn"
                            onClick={() => handleToggle(tpl)}
                            title={tpl.is_active ? 'Tắt' : 'Kích hoạt'}
                          >
                            {tpl.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                          </button>
                          <button
                            type="button"
                            className="email-action-btn danger"
                            onClick={() => handleDelete(tpl)}
                            title="Xóa"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="cms-pagination">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
            >
              Trước
            </button>
            <span>Trang {page}/{totalPages}</span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setOffset(offset + LIMIT)}
            >
              Sau
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB: Send Email ─── */}
      {activeTab === 'send' && (
        <EmailSendForm
          onSent={() => {
            setLogRefreshSignal((n) => n + 1);
            showToast('✓ Email đã được gửi, xem lại ở tab Lịch sử');
          }}
        />
      )}

      {/* ─── TAB: Variables Reference ─── */}
      {activeTab === 'variables' && (
        <div className="panel email-cms-panel">
          <EmailVariables />
        </div>
      )}

      {/* ─── TAB: Logs ─── */}
      {activeTab === 'logs' && (
        <div className="panel email-cms-panel">
          <EmailLogsTable refreshSignal={logRefreshSignal} />
        </div>
      )}

      {/* ─── Template Editor Modal ─── */}
      {showEditor && (
        <TemplateEditor
          template={editorTemplate}
          onClose={() => setShowEditor(false)}
          onSaved={handleEditorSaved}
          readOnly={editorReadOnly}
        />
      )}
    </div>
  );
};
