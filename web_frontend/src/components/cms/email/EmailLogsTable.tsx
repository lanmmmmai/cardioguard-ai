import React, { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { API_URL } from '../../../config';
import { useAuth } from '../../../auth/AuthContext';

const STATUS_OPTIONS = ['', 'sent', 'failed', 'pending', 'scheduled'];
const STATUS_LABELS: Record<string, string> = {
  sent: 'Đã gửi',
  failed: 'Thất bại',
  pending: 'Chờ xử lý',
  scheduled: 'Lên lịch',
};
const STATUS_COLORS: Record<string, string> = {
  sent: 'var(--color-safe)',
  failed: 'var(--color-critical)',
  pending: 'var(--color-warning, #f59e0b)',
  scheduled: 'var(--color-info, #3b82f6)',
};

interface Log {
  id: string;
  receiver_email: string;
  subject: string;
  template_name: string | null;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
}

interface EmailLogsTableProps {
  refreshSignal?: number; // increment để trigger refresh từ bên ngoài
}

export const EmailLogsTable: React.FC<EmailLogsTableProps> = ({ refreshSignal }) => {
  const { accessToken } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const LIMIT = 20;

  const fetchLogs = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
      });
      if (q) params.set('q', q);
      if (status) params.set('status', status);

      const res = await fetch(`${API_URL}/email/logs?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Tải thất bại');
      setLogs(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [accessToken, q, status, offset, refreshSignal]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setOffset(0); }, [q, status]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleRetry = async (logId: string) => {
    setRetrying(logId);
    try {
      const res = await fetch(`${API_URL}/email/logs/${logId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      showToast(data.success ? '✓ Đã gửi lại thành công' : '✗ Gửi lại thất bại');
      fetchLogs();
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`);
    } finally {
      setRetrying(null);
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    window.open(`${API_URL}/email/export-logs?${params}&Authorization=Bearer ${accessToken}`);
    // Dùng fetch thay window.open để có auth header
    fetch(`${API_URL}/email/export-logs?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `email_logs_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  };

  const formatDate = (dt: string | null) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const page = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="email-logs-container">
      {toast && <div className="cms-toast">{toast}</div>}

      {/* Toolbar */}
      <div className="email-logs-toolbar">
        <div className="email-logs-filters">
          <label className="email-logs-search-wrap">
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              className="email-logs-search"
              placeholder="Tìm email, subject..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <select
            className="form-control email-logs-status-filter"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s ? STATUS_LABELS[s] : 'Tất cả trạng thái'}</option>
            ))}
          </select>
        </div>
        <div className="email-logs-actions">
          <button type="button" className="btn btn-secondary" onClick={fetchLogs}>
            <RefreshCw size={14} />
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleExport}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="cms-inline-error">{error}</div>
      )}

      {/* Table */}
      <div className="email-logs-table-wrap">
        <table className="email-logs-table">
          <thead>
            <tr>
              <th>Người nhận</th>
              <th>Subject</th>
              <th>Template</th>
              <th>Trạng thái</th>
              <th>Thời gian gửi</th>
              <th>Người gửi</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px' }}>
                  <Loader2 className="beat-animated" size={20} style={{ margin: 'auto', display: 'block' }} />
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="email-logs-empty">
                  Không có lịch sử gửi email
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="email-logs-row">
                  <td className="email-logs-cell email-cell">
                    <span title={log.receiver_email}>{log.receiver_email}</span>
                  </td>
                  <td className="email-logs-cell subject-cell" title={log.subject}>
                    {log.subject.length > 45 ? `${log.subject.slice(0, 45)}...` : log.subject}
                  </td>
                  <td className="email-logs-cell">
                    <span className="template-name-badge">{log.template_name || '—'}</span>
                  </td>
                  <td className="email-logs-cell">
                    <span
                      className="email-status-badge"
                      style={{ color: STATUS_COLORS[log.status] || 'var(--text-muted)' }}
                    >
                      {log.status === 'failed' ? '✗' : log.status === 'sent' ? '✓' : '○'}{' '}
                      {STATUS_LABELS[log.status] || log.status}
                    </span>
                    {log.error_message && (
                      <div className="email-log-error-msg" title={log.error_message}>
                        {log.error_message.slice(0, 60)}...
                      </div>
                    )}
                  </td>
                  <td className="email-logs-cell muted-cell">{formatDate(log.sent_at)}</td>
                  <td className="email-logs-cell muted-cell">{log.created_by || '—'}</td>
                  <td className="email-logs-cell">
                    {log.status === 'failed' && (
                      <button
                        type="button"
                        className="btn btn-secondary email-retry-btn"
                        onClick={() => handleRetry(log.id)}
                        disabled={retrying === log.id}
                        title="Gửi lại"
                      >
                        {retrying === log.id
                          ? <Loader2 size={12} className="beat-animated" />
                          : <RotateCcw size={12} />}
                        Thử lại
                      </button>
                    )}
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
        <span>Trang {page}/{totalPages} · {total} bản ghi</span>
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
  );
};
