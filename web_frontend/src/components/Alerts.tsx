/**
 * @purpose Trình xem nhật ký cảnh báo thời gian thực. Hiển thị, lọc và xác nhận xử lý
 *          các cảnh báo bệnh nhân (nguy kịch/nghiêm trọng/trung bình/thấp). Hỗ trợ tìm
 *          kiếm theo tên bệnh nhân và lọc theo mức độ cũng như trạng thái xử lý.
 * @workflow  1. Nhận dữ liệu cảnh báo từ component cha (App.tsx) → 2. Áp dụng tiêu chí
 *            tìm kiếm và lọc → 3. Hiển thị danh sách dạng thời gian với huy hiệu mức độ →
 *            4. Bác sĩ/quản trị viên có thể đánh dấu đã xử lý qua API PATCH.
 * @relationships
 *   - App.tsx (truyền dữ liệu cảnh báo)
 *   - AuthContext (kiểm tra quyền xác nhận xử lý)
 *   - severity utility để lấy màu sắc và biểu tượng huy hiệu
 *   - Kiểu Alert từ types.ts
 */
import React, { useState, useEffect } from 'react';
import { Search, Filter, ShieldCheck, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { getSeverityMeta } from '../utils/severity';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { Alert } from '../types';

interface AlertsProps {
  alerts: Alert[];
}

/**
 * Component quản lý cảnh báo. Hiển thị danh sách cảnh báo có thể tìm kiếm và lọc,
 * cho phép bác sĩ/quản trị viên đánh dấu đã xử lý.
 */
export const Alerts: React.FC<AlertsProps> = ({ alerts }) => {
  const { accessToken, role } = useAuth();
  const [localAlerts, setLocalAlerts] = useState<Alert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('unresolved');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalAlerts(alerts);
  }, [alerts]);

  const handleResolve = async (alertId: string) => {
    if (!accessToken || !alertId) return;
    setResolvingId(alertId);
    try {
      const response = await fetch(`${API_URL}/alerts/${alertId}/resolve`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (response.ok) {
        setLocalAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_resolved: true } : a));
      } else {
        let data;

        try {

          data = await response.json();

        } catch (e) {

          throw new Error("Lỗi định dạng phản hồi từ server");

        }
        setError(data.detail || 'Không thể xác nhận xử lý cảnh báo');
      setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      setError('Lỗi kết nối máy chủ khi xử lý cảnh báo');
      setTimeout(() => setError(null), 5000);
    } finally {
      setResolvingId(null);
    }
  };

  const filteredAlerts = localAlerts.filter(a => {
    const matchesSearch = (a.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.alert_type.toLowerCase().includes(searchQuery.toLowerCase());
                          
    const matchesSeverity = severityFilter === 'all' ? true : a.severity === severityFilter;
    
    const matchesStatus = statusFilter === 'all' 
      ? true 
      : statusFilter === 'resolved' 
        ? a.is_resolved === true 
        : a.is_resolved !== true;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  return (
    <div>
      
      {error && (
        <div className="alert-strip high" style={{ marginBottom: '1rem' }}>
          <div className="alert-strip-body">
            <div className="alert-strip-desc">{error}</div>
          </div>
        </div>
      )}
<div className="page-header">
        <div>
          <h1 className="page-title">Nhật Ký Cảnh Báo</h1>
          <p className="page-subtitle">Xem toàn bộ lịch sử cảnh báo bất thường trong hệ thống ({localAlerts.length})</p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '1.5rem', padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Tìm kiếm theo tên bệnh nhân hoặc nội dung..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '45px', border: 'none', background: 'transparent' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Mức độ:</span>
          <select
            className="form-control"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{ width: '150px', height: '36px', padding: '4px 10px' }}
          >
            <option value="all">Tất cả mức độ</option>
            <option value="critical">Nguy kịch (Critical)</option>
            <option value="high">Nghiêm trọng (High)</option>
            <option value="medium">Cảnh báo (Medium)</option>
            <option value="low">Theo dõi (Low)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Trạng thái:</span>
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '150px', height: '36px', padding: '4px 10px' }}
          >
            <option value="unresolved">Chưa xử lý</option>
            <option value="resolved">Đã xử lý</option>
            <option value="all">Tất cả trạng thái</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredAlerts.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={48} style={{ color: 'var(--color-bp)', opacity: 0.8, marginBottom: '1rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Không có cảnh báo nào</div>
            <p className="page-subtitle">Hệ thống ổn định hoặc không có cảnh báo phù hợp với bộ lọc hiện tại.</p>
          </div>
        ) : (
          filteredAlerts.map((alert, index) => {
            const severityMeta = getSeverityMeta(alert.severity);
            const AlertIcon = severityMeta.icon;
            return (
              <div 
                key={alert.id || index} 
                className={`panel alert-strip ${severityMeta.key} ${alert.is_resolved ? 'resolved' : ''}`}
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  padding: '16px 20px', 
                  margin: 0,
                  borderLeft: `3px solid ${alert.is_resolved ? '#10b981' : severityMeta.colorVar}`,
                  background: alert.is_resolved ? 'rgba(16, 185, 129, 0.02)' : severityMeta.bgVar,
                  opacity: alert.is_resolved ? 0.75 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                {alert.is_resolved ? (
                  <CheckCircle className="alert-strip-icon" size={20} style={{ marginRight: '16px', color: '#10b981' }} />
                ) : (
                  <AlertIcon className="alert-strip-icon" size={20} style={{ marginRight: '16px', color: severityMeta.colorVar }} />
                )}
                
                <div className="alert-strip-body" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-display)' }}>
                        {alert.full_name || 'Bệnh nhân ẩn danh'}
                      </span>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', textTransform: 'none' }}>
                        BN ID: {alert.patient_id.slice(0, 8)}...
                      </span>
                      {!alert.is_resolved ? (
                        <span className="badge" style={{ background: severityMeta.bgVar, color: severityMeta.colorVar, border: severityMeta.borderVar, fontWeight: severityMeta.weight }}>
                          {severityMeta.label}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', fontWeight: 600 }}>
                          Đã xử lý
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span className="tabular-nums">
                        {alert.created_at 
                          ? new Date(alert.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' }) 
                          : 'Vừa xong'}
                      </span>
                    </div>
                  </div>

                  <div style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 500, marginBottom: '4px' }}>
                    {alert.alert_type}
                  </div>
                  <div className="alert-strip-desc" style={{ fontSize: '0.88rem', marginBottom: '8px' }}>
                    {alert.message}
                  </div>

                  {!alert.is_resolved && (role === 'doctor' || role === 'admin') && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ 
                        padding: '5px 12px', 
                        height: 'auto', 
                        fontSize: '0.75rem', 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        color: '#10b981', 
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleResolve(alert.id!)}
                      disabled={resolvingId === alert.id}
                    >
                      {resolvingId === alert.id ? (
                        <>
                          <Loader2 size={12} className="beat-animated" /> Đang xử lý...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={12} /> Xác nhận đã xử lý
                        </>
                      )}
                    </button>
                  )}

                  {alert.is_resolved && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.8rem', fontWeight: 600, marginTop: '4px' }}>
                      <CheckCircle size={12} /> Đã được bác sĩ/admin xác nhận xử lý thành công
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Alerts;
