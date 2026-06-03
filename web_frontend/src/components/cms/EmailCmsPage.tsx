/**
 * Mục đích: Trang quản trị Email CMS: quản lý template, gửi email, xem tham chiếu biến động và nhật ký.
 * Luồng xử lý: Giao diện bốn tab: Templates (danh sách/tìm kiếm/sửa/nhân bản/bật tắt/xóa), Send (soạn
 *              và gửi với thay thế biến động), Variables (lưới tham chiếu), Logs (lịch sử gửi với
 *              chức năng gửi lại). Trình chỉnh sửa template mở dưới dạng hộp thoại.
 * Quan hệ: Sử dụng AuthContext cho accessToken/role; ủy quyền cho các component con
 *          TemplateEditor, EmailSendForm, EmailLogsTable và EmailVariables.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Copy, Edit2, FileText, History,
  Loader2, Mail, Plus, RefreshCw, Search,
  Send, Trash2, ToggleLeft, ToggleRight, Variable,
} from 'lucide-react';
import { API_URL } from '../../config';
import { useAuth } from '../../auth/AuthContext';
import { TemplateEditor } from './email/TemplateEditor';
import { EmailSendForm } from './email/EmailSendForm';
import { EmailLogsTable } from './email/EmailLogsTable';
import { EmailVariables } from './email/EmailVariables';

// ───────────────────────────────────────────────────────────
// Các tab
// ───────────────────────────────────────────────────────────
type TabKey = 'templates' | 'send' | 'variables' | 'logs';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'templates', label: 'Danh sách template', icon: <FileText size={15} /> },
  { key: 'send',      label: 'Soạn & Gửi',         icon: <Send size={15} /> },
  { key: 'variables', label: 'Biến động',            icon: <Variable size={15} /> },
  { key: 'logs',      label: 'Lịch sử gửi',          icon: <History size={15} /> },
];

// ───────────────────────────────────────────────────────────
// Bản đồ hiển thị loại template
// ───────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  otp_register:         'OTP Đăng ký',
  otp_login:            'OTP Đăng nhập',
  welcome:              'Chào mừng',
  password_reset:       'Đặt lại mật khẩu',
  alert_critical:       'Cảnh báo khẩn',
  appointment_reminder: 'Nhắc lịch hẹn',
  doctor_assigned:      'Phân công BS',
  health_warning:       'Cảnh báo SK',
  monthly_report:       'Báo cáo tháng',
  custom:               'Tùy chỉnh',
};

interface Template {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ───────────────────────────────────────────────────────────
// Component chính
// ───────────────────────────────────────────────────────────
export const EmailCmsPage: React.FC = () => {
  const { accessToken, role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('templates');

  // Trạng thái templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [logRefreshSignal, setLogRefreshSignal] = useState(0);

  // Trạng thái trình soạn thảo
  const [showEditor, setShowEditor] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<Template | null>(null);

  const LIMIT = 15;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // ──────────────────────────────
  // Tải danh sách templates
  // ──────────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
      if (q) params.set('q', q);
      const res = await fetch(`${API_URL}/email/templates?${params}`, {
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
  // Các hành động
  // ──────────────────────────────
  const handleEdit = (tpl: Template) => {
    setEditorTemplate(tpl);
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditorTemplate(null);
    setShowEditor(true);
  };

  const handleEditorSaved = () => {
    setShowEditor(false);
    fetchTemplates();
    showToast('✓ Template đã được lưu thành công');
  };

  const handleDuplicate = async (tpl: Template) => {
    try {
      const res = await fetch(`${API_URL}/email/templates/${tpl.id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Nhân bản thất bại');
      await fetchTemplates();
      showToast(`✓ Đã nhân bản "${tpl.name}"`);
    } catch (err: any) {
      showToast(`✗ ${err.message}`);
    }
  };

  const handleToggle = async (tpl: Template) => {
    try {
      const res = await fetch(`${API_URL}/email/templates/${tpl.id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setTemplates((prev) =>
        prev.map((t) => t.id === tpl.id ? { ...t, is_active: data.is_active } : t)
      );
      showToast(`${data.is_active ? '✓ Đã bật' : '○ Đã tắt'} template "${tpl.name}"`);
    } catch (err: any) {
      showToast(`✗ ${err.message}`);
    }
  };

  const handleDelete = async (tpl: Template) => {
    if (!window.confirm(`Xóa template "${tpl.name}"? Hành động này không thể hoàn tác.`)) return;
    try {
      const res = await fetch(`${API_URL}/email/templates/${tpl.id}`, {
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

      {/* Tiêu đề trang */}
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
                <Plus size={14} /> Tạo template
              </button>
            </>
          )}
        </div>
      </div>

      {/* Điều hướng tab */}
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

      {/* ─── TAB: Danh sách templates ─── */}
      {activeTab === 'templates' && (
        <div className="panel email-cms-panel">
          {/* Bộ lọc */}
          <div className="email-templates-toolbar">
            <label className="email-logs-search-wrap">
              <Search size={15} style={{ color: 'var(--text-muted)' }} />
              <input
                className="email-logs-search"
                placeholder="Tìm tên template, subject..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <span className="email-templates-count">{total} templates</span>
          </div>

          {error && <div className="cms-inline-error">{error}</div>}

          {/* Bảng */}
          <div className="email-logs-table-wrap">
            <table className="email-logs-table">
              <thead>
                <tr>
                  <th>Tên template</th>
                  <th>Subject</th>
                  <th>Loại</th>
                  <th>Cập nhật</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px' }}>
                      <Loader2 className="beat-animated" size={20} style={{ margin: 'auto', display: 'block' }} />
                    </td>
                  </tr>
                ) : templates.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="email-logs-empty">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Mail size={32} style={{ opacity: 0.3 }} />
                        <span>Chưa có template nào. Tạo template đầu tiên!</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  templates.map((tpl) => (
                    <tr key={tpl.id} className="email-logs-row">
                      <td className="email-logs-cell">
                        <div className="template-name-main">{tpl.name}</div>
                      </td>
                      <td className="email-logs-cell subject-cell" title={tpl.subject}>
                        {tpl.subject.length > 50 ? `${tpl.subject.slice(0, 50)}...` : tpl.subject}
                      </td>
                      <td className="email-logs-cell">
                        <span className="email-type-badge">{TYPE_LABELS[tpl.type] || tpl.type}</span>
                      </td>
                      <td className="email-logs-cell muted-cell">{formatDate(tpl.updated_at)}</td>
                      <td className="email-logs-cell">
                        <span
                          className="email-status-badge"
                          style={{ color: tpl.is_active ? 'var(--color-safe)' : 'var(--text-muted)' }}
                        >
                          {tpl.is_active ? <><CheckCircle2 size={13} /> Hoạt động</> : '○ Tắt'}
                        </span>
                      </td>
                      <td className="email-logs-cell">
                        <div className="email-template-actions">
                          <button
                            type="button"
                            className="email-action-btn"
                            onClick={() => handleEdit(tpl)}
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="email-action-btn"
                            onClick={() => handleDuplicate(tpl)}
                            title="Nhân bản"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            className="email-action-btn"
                            onClick={() => handleToggle(tpl)}
                            title={tpl.is_active ? 'Tắt' : 'Bật'}
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

          {/* Phân trang */}
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

      {/* ─── TAB: Gửi Email ─── */}
      {activeTab === 'send' && (
        <EmailSendForm
          onSent={() => {
            setLogRefreshSignal((n) => n + 1);
            showToast('✓ Email đã được gửi, xem lại ở tab Lịch sử');
          }}
        />
      )}

      {/* ─── TAB: Tham chiếu Biến động ─── */}
      {activeTab === 'variables' && (
        <div className="panel email-cms-panel">
          <EmailVariables />
        </div>
      )}

      {/* ─── TAB: Nhật ký ─── */}
      {activeTab === 'logs' && (
        <div className="panel email-cms-panel">
          <EmailLogsTable refreshSignal={logRefreshSignal} />
        </div>
      )}

      {/* ─── Hộp thoại chỉnh sửa Template ─── */}
      {showEditor && (
        <TemplateEditor
          template={editorTemplate}
          onClose={() => setShowEditor(false)}
          onSaved={handleEditorSaved}
        />
      )}
    </div>
  );
};
