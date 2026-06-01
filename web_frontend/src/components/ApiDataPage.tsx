import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, RefreshCw, ExternalLink } from 'lucide-react';
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

  // Helper dịch tiêu đề cột sang tiếng Việt chuyên nghiệp
  const formatHeader = (col: string) => {
    const dict: Record<string, string> = {
      id: 'ID',
      action: 'Hành động',
      entity_type: 'Loại đối tượng',
      entity_id: 'ID đối tượng',
      ip_address: 'Địa chỉ IP',
      created_at: 'Thời gian tạo',
      updated_at: 'Cập nhật cuối',
      camera_name: 'Tên Camera',
      location: 'Vị trí phòng',
      stream_url: 'Luồng Video',
      status: 'Trạng thái',
      title: 'Tiêu đề',
      report_type: 'Phân loại',
      content: 'Nội dung lâm sàng',
      file_url: 'Liên kết file',
      user_id: 'Mã người dùng',
      assigned_patient_id: 'Mã bệnh nhân',
      dosage: 'Liều lượng',
      frequency: 'Tần suất',
      medication_name: 'Tên thuốc',
      instructions: 'Chỉ định bác sĩ',
    };
    return dict[col] || col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' ');
  };

  // Helper định dạng hiển thị giá trị lâm sàng/hệ thống thông minh
  const formatValue = (col: string, val: any) => {
    if (val === null || val === undefined) return '-';
    
    // 1. Định dạng Ngày tháng năm tiếng Việt
    if (col === 'created_at' || col === 'updated_at') {
      try {
        return (
          <span className="tabular-nums" style={{ fontSize: '0.85rem' }}>
            {new Date(val).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </span>
        );
      } catch {
        return String(val);
      }
    }
    
    // 2. Huy hiệu Trạng thái sinh động
    if (col === 'status') {
      const statusStr = String(val).toLowerCase();
      if (statusStr === 'online' || statusStr === 'active' || statusStr === 'success') {
        return (
          <span className="patient-status normal" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
            {String(val).toUpperCase()}
          </span>
        );
      }
      if (statusStr === 'offline' || statusStr === 'inactive' || statusStr === 'failed') {
        return (
          <span className="patient-status critical" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(255, 51, 102, 0.1)', color: 'var(--color-critical)', border: '1px solid rgba(255, 51, 102, 0.2)' }}>
            {String(val).toUpperCase()}
          </span>
        );
      }
    }
    
    // 3. Rút ngắn mã UUID phức tạp kèm tooltip
    if (String(val).length > 30 && /^[0-9a-fA-F-]{36}$/.test(String(val))) {
      return (
        <span title={String(val)} className="tabular-nums" style={{ fontFamily: 'monospace', opacity: 0.85, fontSize: '0.82rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
          {String(val).slice(0, 8)}...
        </span>
      );
    }
    
    // 4. Định dạng siêu liên kết cho Video / Web link
    if (typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'))) {
      return (
        <a href={val} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontWeight: 600 }}>
          Xem liên kết <ExternalLink size={12} />
        </a>
      );
    }
    
    // 5. Định dạng dữ liệu phức tạp JSON
    if (typeof val === 'object') {
      return (
        <pre style={{ margin: 0, fontSize: '0.76rem', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', fontFamily: 'monospace', overflowX: 'auto', maxWidth: '220px' }}>
          {JSON.stringify(val)}
        </pre>
      );
    }
    
    return String(val);
  };

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

      <section className="panel" style={{ padding: '20px' }}>
        <h3 className="metric-title" style={{ marginBottom: '1.25rem', fontSize: '0.95rem', letterSpacing: '0.5px' }}>
          <Database size={16} style={{ color: 'var(--color-primary)' }} /> API ENDPOINT: {endpoint}
        </h3>
        
        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="beat-animated" style={{ margin: '0 auto 10px', color: 'var(--color-primary)' }} />
            Đang tải dữ liệu thực tế từ máy chủ...
          </div>
        ) : error ? (
          <div className="alert-strip high">
            <AlertTriangle size={16} className="alert-strip-icon" />
            <div className="alert-strip-body">
              <div className="alert-strip-title">Không thể tải dữ liệu</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chưa có bản ghi thật nào trong bảng này theo phân quyền của bạn.
          </div>
        ) : (
          <div className="cms-table-wrap" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
            <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {columns.map((column) => (
                    <th key={column} style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--glass-border)' }}>
                      {formatHeader(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={String(row.id || index)} className="table-row-hover" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {columns.map((column) => (
                      <td key={column} style={{ padding: '14px 16px', verticalAlign: 'middle', color: 'var(--text-primary)' }}>
                        {formatValue(column, row[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
