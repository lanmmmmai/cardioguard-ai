import React, { useState } from 'react';
import { AlertTriangle, Search, Filter, ShieldCheck, Calendar } from 'lucide-react';

interface Alert {
  id?: string;
  patient_id: string;
  full_name?: string;
  alert_type: string;
  message: string;
  severity: string;
  is_resolved?: boolean;
  created_at?: string;
}

interface AlertsProps {
  alerts: Alert[];
}

export const Alerts: React.FC<AlertsProps> = ({ alerts }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  // Filter alerts
  const filteredAlerts = alerts.filter(a => {
    const matchesSearch = (a.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          a.alert_type.toLowerCase().includes(searchQuery.toLowerCase());
                          
    const matchesSeverity = severityFilter === 'all' ? true : a.severity === severityFilter;

    return matchesSearch && matchesSeverity;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nhật Ký Cảnh Báo</h1>
          <p className="page-subtitle">Xem toàn bộ lịch sử cảnh báo bất thường trong hệ thống ({alerts.length})</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="panel" style={{ marginBottom: '1.5rem', padding: '16px 20px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
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
            style={{ width: '150px', height: '38px', padding: '4px 10px' }}
          >
            <option value="all">Tất cả mức độ</option>
            <option value="high">Nguy kịch (High)</option>
            <option value="medium">Cần chú ý (Medium)</option>
            <option value="low">Bình thường (Low)</option>
          </select>
        </div>
      </div>

      {/* Alerts Timeline List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredAlerts.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={48} style={{ color: 'var(--color-bp)', opacity: 0.8, marginBottom: '1rem' }} />
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Không có cảnh báo nào</div>
            <p className="page-subtitle">Hệ thống hoạt động ổn định. Chưa ghi nhận bất kỳ cảnh báo nào khớp với bộ lọc.</p>
          </div>
        ) : (
          filteredAlerts.map((alert, index) => (
            <div 
              key={alert.id || index} 
              className={`panel alert-strip ${alert.severity === 'high' ? 'high' : 'medium'}`}
              style={{ display: 'flex', alignItems: 'flex-start', padding: '16px 20px', margin: 0 }}
            >
              <AlertTriangle className="alert-strip-icon" size={20} style={{ marginRight: '16px' }} />
              <div className="alert-strip-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-display)' }}>
                      {alert.full_name || 'Bệnh nhân ẩn danh'}
                    </span>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', textTransform: 'none' }}>
                      BN ID: {alert.patient_id.slice(0, 8)}...
                    </span>
                    <span className={`badge ${alert.severity === 'high' ? 'high' : 'medium'}`}>
                      {alert.severity}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <Calendar size={12} />
                    <span>
                      {alert.created_at 
                        ? new Date(alert.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' }) 
                        : 'Vừa xong'}
                    </span>
                  </div>
                </div>

                <div style={{ color: 'var(--text-primary)', fontSize: '0.92rem', fontWeight: 500, marginBottom: '4px' }}>
                  {alert.alert_type}
                </div>
                <div className="alert-strip-desc" style={{ fontSize: '0.88rem' }}>
                  {alert.message}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
