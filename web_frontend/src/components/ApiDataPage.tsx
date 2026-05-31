import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';

interface ApiDataPageProps {
  title: string;
  subtitle: string;
  endpoint: string;
}

export const ApiDataPage: React.FC<ApiDataPageProps> = ({ title, subtitle, endpoint }) => {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Không lấy được dữ liệu');
      setRows(Array.isArray(data) ? data : [data]);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRows([]);
    fetchRows();
  }, [accessToken, endpoint]);

  const columns = useMemo(() => {
    const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    return keys.filter((key) => key !== 'updated_at').slice(0, 7);
  }, [rows]);

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={fetchRows} disabled={loading}>
          <RefreshCw size={14} /> Làm mới
        </button>
      </div>

      <section className="panel">
        <h3 className="metric-title"><Database size={18} /> API: {endpoint}</h3>
        {loading ? (
          <p className="role-muted">Đang tải dữ liệu...</p>
        ) : error ? (
          <div className="alert-strip high">
            <AlertTriangle size={16} className="alert-strip-icon" />
            <div className="alert-strip-body">
              <div className="alert-strip-title">Không thể tải dữ liệu</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <p className="role-muted">Chưa có bản ghi thật theo quyền hiện tại.</p>
        ) : (
          <div className="activity-list">
            {rows.map((row, index) => (
              <div key={String(row.id || index)}>
                {columns.map((column) => (
                  <span key={column} style={{ marginRight: '12px' }}>
                    <strong>{column}:</strong> {String(row[column] ?? '')}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
