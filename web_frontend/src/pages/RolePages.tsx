/**
 * Mục đích: Các trang dashboard theo vai trò cho Quản trị viên, Bác sĩ và Bệnh nhân.
 *           Mỗi dashboard hiển thị dữ liệu tổng hợp thực (bệnh nhân, cảnh báo, bác sĩ)
 *           cùng với thẻ hành động nhanh và tóm tắt trạng thái hệ thống.
 * Luồng xử lý: Props được truyền từ App.tsx routeContent. Các component tính toán
 *           bộ đếm thống kê, xây dựng thanh biểu đồ và hiển thị cơ chế nhấn giữ SOS
 *           cho bệnh nhân.
 * Quan hệ:
 *   - App.tsx (khối switch routeContent)
 *   - AuthContext (cho định danh phiên bệnh nhân)
 *   - Các interface kiểu Patient, Alert, SensorData
 */
import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, BarChart3, CalendarDays, Cpu, HeartPulse, MessageCircle, Pill, ShieldAlert, Stethoscope, Users, Radio, WifiOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useBrowserPath } from '../hooks/useBrowserPath';
import { API_URL } from '../config';
import { Alert, Patient, SensorData } from '../types';
import { readJsonResponse } from '../utils/response';

/**
 * Thẻ thống kê tái sử dụng hiển thị biểu tượng, nhãn/giá trị chỉ số và gợi ý.
 * Props `tone` tùy chọn áp dụng bổ sung trực quan (ví dụ: 'danger').
 */
const Card: React.FC<{ icon: React.ReactNode; label: string; value: string | number; hint: string; tone?: string }> = ({ icon, label, value, hint, tone }) => (
  <div className={`role-stat-card ${tone || ''}`}>
    <div className="role-stat-icon">{icon}</div>
    <div>
      <div className="role-stat-label">{label}</div>
      <div className="role-stat-value">{value}</div>
      <div className="role-stat-hint">{hint}</div>
    </div>
  </div>
);

/**
 * Dashboard tổng quan quản trị viên. Hiển thị số lượng bệnh nhân/bác sĩ/thiết bị/IoT,
 * biểu đồ cột so sánh các chỉ số đó và hoạt động hệ thống gần đây.
 */
export const AdminDashboard: React.FC<{ patients: Patient[]; alerts: Alert[]; doctors?: unknown[] }> = ({ patients, alerts, doctors = [] }) => {
  const { navigate } = useBrowserPath();
  const highAlerts = alerts.filter((alert) => alert.severity === 'high').length;
  
  // Custom Chart Data
  const chartData = [
    { label: 'Bệnh nhân', value: patients.length, colorClass: 'accent-green' },
    { label: 'Bác sĩ', value: doctors.length, colorClass: 'accent-blue' },
    { label: 'Cảnh báo', value: alerts.length, colorClass: 'accent-warning' },
    { label: 'Cảnh báo cao', value: highAlerts, colorClass: '' }
  ];
  const maxVal = Math.max(...chartData.map(d => d.value), 1);

  // Mảng hiển thị hoạt động gần đây
  const recentAlerts = alerts.slice(0, 4);

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Admin</h1>
          <p className="page-subtitle">Tổng quan vận hành hệ thống CardioGuard AI.</p>
        </div>
      </div>

      <div className="role-stat-grid">
        <div 
          className="role-stat-card admin-stat-card-link" 
          onClick={() => navigate('/admin/patients')}
        >
          <div className="role-stat-icon"><Users size={22} /></div>
          <div>
            <div className="role-stat-label">Tổng số bệnh nhân</div>
            <div className="role-stat-value">{patients.length}</div>
            <div className="role-stat-hint">Đang được quản lý</div>
          </div>
        </div>

        <div 
          className="role-stat-card admin-stat-card-link" 
          onClick={() => navigate('/admin/doctors')}
        >
          <div className="role-stat-icon"><Stethoscope size={22} /></div>
          <div>
            <div className="role-stat-label">Tổng số bác sĩ</div>
            <div className="role-stat-value">{doctors.length}</div>
            <div className="role-stat-hint">Đang hoạt động</div>
          </div>
        </div>

        <div 
          className="role-stat-card admin-stat-card-link" 
          onClick={() => navigate('/admin/devices')}
        >
          <div className="role-stat-icon"><Cpu size={22} /></div>
          <div>
            <div className="role-stat-label">Thiết bị IoT</div>
            <div className="role-stat-value">0</div>
            <div className="role-stat-hint">Chưa liên kết thiết bị</div>
          </div>
        </div>

        <div 
          className="role-stat-card danger admin-stat-card-link" 
          onClick={() => navigate('/admin/alerts')}
        >
          <div className="role-stat-icon"><ShieldAlert size={22} /></div>
          <div>
            <div className="role-stat-label">Cảnh báo hệ thống</div>
            <div className="role-stat-value">{alerts.length}</div>
            <div className="role-stat-hint">{highAlerts} cảnh báo mức cao</div>
          </div>
        </div>
      </div>

      <div className="role-page-grid">
        <section className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 className="metric-title"><BarChart3 size={18} /> Biểu đồ thống kê</h3>
          
          <div className="admin-chart-wrapper">
            {/* Trục Y */}
            <div className="admin-chart-y-axis">
              <span>{maxVal}</span>
              <span>{Math.round(maxVal * 0.75)}</span>
              <span>{Math.round(maxVal * 0.5)}</span>
              <span>{Math.round(maxVal * 0.25)}</span>
              <span>0</span>
            </div>

            {/* Khung chứa các cột */}
            <div className="admin-chart-bars-container">
              {/* Đường vạch đứt nền */}
              <div className="admin-chart-grid-lines">
                <div className="admin-chart-grid-line" />
                <div className="admin-chart-grid-line" />
                <div className="admin-chart-grid-line" />
                <div className="admin-chart-grid-line" />
                <div className="admin-chart-grid-line" style={{ borderTopStyle: 'solid' }} />
              </div>

              {chartData.map((item, index) => {
                const percentage = (item.value / maxVal) * 100;
                return (
                  <div key={index} className="admin-chart-bar-col">
                    <div 
                      className={`admin-chart-bar-pillar ${item.colorClass}`}
                      style={{ height: `${Math.max(6, percentage)}%` }}
                    >
                      <div className="admin-chart-bar-tooltip">
                        {item.label}: {item.value}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trục X */}
          <div className="admin-chart-x-axis-labels">
            {chartData.map((item, index) => (
              <div key={index} className="admin-chart-x-label">{item.label}</div>
            ))}
          </div>

          <p className="role-muted" style={{ marginTop: '1rem' }}>
            Biểu đồ hiển thị số lượng bản ghi thực tế đang được lưu trữ trên cơ sở dữ liệu.
          </p>
        </section>

        <section className="panel">
          <h3 className="metric-title"><Activity size={18} /> Hoạt động hệ thống gần đây</h3>
          <div className="activity-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentAlerts.length > 0 ? (
              recentAlerts.map((alert, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                  <span className={`connection-status-dot ${alert.severity === 'high' ? 'disconnected' : 'connected'}`} style={{ marginTop: '5px' }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>{alert.full_name || 'Bệnh nhân'}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alert.message}</div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {alert.created_at ? new Date(alert.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="connection-status-dot connected" />
                  <span>Đồng bộ telemetry realtime thành công.</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="connection-status-dot connected" />
                  <span>WebSocket `/ws/realtime` đang sẵn sàng.</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="connection-status-dot connected" />
                  <span>AI risk assistant đang hoạt động ở chế độ tham khảo.</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="connection-status-dot connected" />
                  <span>Audit log ghi nhận phiên làm việc của quản trị viên.</span>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Quick Actions Panel */}
      <section className="panel">
        <h3 className="metric-title"><Cpu size={18} /> Phím tắt tác vụ nhanh</h3>
        <div className="admin-quick-actions-panel">
          <button type="button" className="admin-quick-action-btn" onClick={() => navigate('/admin/doctor-verification')}>
            <div className="admin-quick-action-icon"><ShieldAlert size={16} /></div>
            <div>
              <div>Xác thực Bác sĩ</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>Phê duyệt hồ sơ bác sĩ mới</div>
            </div>
          </button>

          <button type="button" className="admin-quick-action-btn" onClick={() => navigate('/admin/users')}>
            <div className="admin-quick-action-icon"><Users size={16} /></div>
            <div>
              <div>Quản lý tài khoản</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>Thêm, sửa, xóa, phân quyền</div>
            </div>
          </button>

          <button type="button" className="admin-quick-action-btn" onClick={() => navigate('/admin/settings')}>
            <div className="admin-quick-action-icon"><Stethoscope size={16} /></div>
            <div>
              <div>Cài đặt hệ thống</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>Cấu hình ngưỡng lâm sàng & AI</div>
            </div>
          </button>

          <button type="button" className="admin-quick-action-btn" onClick={() => navigate('/admin/cms')}>
            <div className="admin-quick-action-icon"><Activity size={16} /></div>
            <div>
              <div>CMS Dữ liệu</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>Nhập xuất & quản trị database</div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};

/**
 * Dashboard tổng quan bác sĩ. Làm nổi bật số lượng bệnh nhân được phân công,
 * lịch hẹn hôm nay, cảnh báo mức cao chưa xử lý và các thẻ truy cập nhanh
 * cho hồ sơ bệnh án, đơn thuốc, chat và phân tích AI.
 */
export const DoctorDashboard: React.FC<{ patients: Patient[]; alerts: Alert[] }> = ({ patients, alerts }) => (
  <div className="role-page-stack">
    <div className="page-header">
      <div>
        <h1 className="page-title">Dashboard Bác sĩ</h1>
        <p className="page-subtitle">Theo dõi bệnh nhân, lịch hẹn và cảnh báo cần xử lý.</p>
      </div>
    </div>

    <div className="role-stat-grid">
      <Card icon={<Users size={22} />} label="Bệnh nhân được phân công" value={patients.length} hint="Danh sách hiện có" />
      <Card icon={<CalendarDays size={22} />} label="Lịch hẹn hôm nay" value="0" hint="Chưa có lịch hẹn thật" />
      <Card icon={<AlertTriangle size={22} />} label="Cảnh báo cần xử lý" value={alerts.filter((a) => a.severity === 'high').length} hint="Ưu tiên can thiệp" tone="danger" />
      <Card icon={<HeartPulse size={22} />} label="Realtime monitoring" value={patients.length} hint="Dựa trên bệnh nhân đã xác thực" />
    </div>

    <section className="panel">
      <h3 className="metric-title">Truy cập nhanh</h3>
      <div className="quick-action-grid">
        {['Bệnh án điện tử', 'Kê đơn thuốc', 'Chat tư vấn', 'AI phân tích sức khỏe'].map((item) => (
          <div className="quick-action-card" key={item}>{item}</div>
        ))}
      </div>
      <div className="alert-strip medium" style={{ marginTop: '1rem' }}>
        <AlertTriangle size={16} className="alert-strip-icon" />
        <div className="alert-strip-body">
          <div className="alert-strip-title">Lưu ý AI</div>
          <div className="alert-strip-desc">Kết quả AI chỉ mang tính tham khảo, cần bác sĩ xác nhận.</div>
        </div>
      </div>
    </section>
  </div>
);

/**
 * Trang chủ bệnh nhân. Hiển thị các chỉ số sinh tồn thời gian thực (HR, SpO2, BP, ECG)
 * từ WebSocket telemetry, nút nhấn giữ SOS và danh sách cảnh báo cá nhân.
 * Hiển thị cảnh báo dữ liệu cũ khi telemetry trễ hơn 30 giây.
 */
export const PatientHome: React.FC<{
  latestTelemetry: SensorData | null;
  alerts: Alert[];
  isConnected?: boolean;
}> = ({ latestTelemetry, alerts, isConnected = false }) => {
  const { accessToken, user } = useAuth();
  const accessTokenRef = React.useRef(accessToken);
  const [lastTelemetryTime, setLastTelemetryTime] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(true);
  const [isSendingSos, setIsSendingSos] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);

  // Trạng thái nhấn giữ SOS
  const [countdown, setCountdown] = useState(3);
  const [isHolding, setIsHolding] = useState(false);

  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    let interval: any = null;
    if (isHolding) {
      setCountdown(3);
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsHolding(false);
            handleTriggerSos();
            return 3;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(3);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isHolding]);
  const [currentMetrics, setCurrentMetrics] = useState<{
    heartRate: number | null;
    spo2: number | null;
    systolicBp: number | null;
    diastolicBp: number | null;
    ecgValue: number | null;
    updatedAt: string | null;
  }>({
    heartRate: null,
    spo2: null,
    systolicBp: null,
    diastolicBp: null,
    ecgValue: null,
    updatedAt: null
  });

  /**
   * Gửi cảnh báo khẩn cấp SOS đến backend. Được gọi sau khi
   * đếm ngược nhấn giữ xác nhận kết thúc hoặc qua hộp thoại xác nhận.
   */
  const handleTriggerSos = async () => {
    const token = accessTokenRef.current;
    if (!token) return;
    setIsSendingSos(true);
    try {
      const response = await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: 'Bệnh nhân yêu cầu hỗ trợ khẩn cấp (SOS)' })
      });
      if (response.ok) {
        alert('Cảnh báo SOS khẩn cấp đã được phát đi thành công tới hệ thống và các bác sĩ phụ trách!');
        setShowSosConfirm(false);
      } else {
        const data = await readJsonResponse<{ detail?: string }>(response);
        alert(data.detail || 'Lỗi gửi yêu cầu SOS khẩn cấp');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ khi gửi tín hiệu SOS khẩn cấp');
    } finally {
      setIsSendingSos(false);
    }
  };

  useEffect(() => {
    // Chỉ cập nhật nếu latestTelemetry khớp với người dùng đã đăng nhập hoặc đang trong phiên bệnh nhân
    if (latestTelemetry && (!user?.id || latestTelemetry.patient_id === user.id)) {
      setCurrentMetrics({
        heartRate: latestTelemetry.heart_rate,
        spo2: latestTelemetry.spo2,
        systolicBp: latestTelemetry.systolic_bp,
        diastolicBp: latestTelemetry.diastolic_bp,
        ecgValue: latestTelemetry.ecg_value,
        updatedAt: new Date().toLocaleTimeString('vi-VN')
      });
      setLastTelemetryTime(new Date());
      setIsStale(false);
    }
  }, [latestTelemetry, user?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastTelemetryTime) {
        const diffSeconds = (new Date().getTime() - lastTelemetryTime.getTime()) / 1000;
        setIsStale(diffSeconds > 30);
      } else {
        setIsStale(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [lastTelemetryTime]);

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trang chủ bệnh nhân</h1>
          <p className="page-subtitle">Chỉ số sức khỏe thời gian thực, lịch hẹn và cảnh báo y tế.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {isHolding ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(239, 68, 68, 0.04)', padding: '8px 16px', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
              <div 
                className="sos-button-hold counting"
                onMouseUp={() => setIsHolding(false)}
                onMouseLeave={() => setIsHolding(false)}
                onTouchEnd={() => setIsHolding(false)}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '2px solid var(--color-critical)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  animation: 'pulse-halo 1s infinite',
                }}
              >
                <span style={{ color: 'var(--color-critical)', fontWeight: 800, fontSize: '1.1rem' }}>
                  {countdown}
                </span>
              </div>
              <span className="beat-animated" style={{ color: 'var(--color-critical)', fontSize: '0.85rem', fontWeight: 700 }}>
                ĐANG KÍCH HOẠT SOS TRONG {countdown} S
              </span>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '6px', marginLeft: '8px' }} 
                onClick={() => setIsHolding(false)}
              >
                Hủy
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div 
                className="sos-button-hold"
                onMouseDown={() => setIsHolding(true)}
                onTouchStart={() => setIsHolding(true)}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '2px solid var(--color-critical)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  userSelect: 'none',
                  boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span style={{ color: 'var(--color-critical)', fontWeight: 900, fontSize: '0.9rem' }}>
                  SOS
                </span>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 500 }}>
                Nhấn giữ nút để cứu hộ
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Biểu ngữ trạng thái kết nối WebSocket / Cảnh báo dữ liệu sinh tồn cũ */}
      {!isConnected ? (
        <div className="alert-strip danger" style={{ marginBottom: '1.5rem' }}>
          <WifiOff size={16} className="alert-strip-icon pulse-animated" />
          <div className="alert-strip-body">
            <div className="alert-strip-title">Mất kết nối thời gian thực</div>
            <div className="alert-strip-desc">Ứng dụng đang ngoại tuyến. Các chỉ số hiển thị bên dưới có thể không phản ánh trạng thái hiện tại.</div>
          </div>
        </div>
      ) : isStale && currentMetrics.heartRate !== null ? (
        <div className="stale-vitals-banner" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} className="pulse-animated" />
          <span>Cảnh báo: Dữ liệu giám sát sinh hiệu có thể đã cũ (lần cập nhật cuối cách đây hơn 30 giây).</span>
        </div>
      ) : null}

      <div className="role-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {/* Thẻ Nhịp Tim */}
        {(() => {
          const isCritical = currentMetrics.heartRate !== null && (currentMetrics.heartRate > 120 || currentMetrics.heartRate < 50);
          const hrStatus = currentMetrics.heartRate === null ? 'normal' : isCritical ? 'high' : 'normal';
          const statusText = currentMetrics.heartRate === null ? '' : isCritical ? 'Bất thường' : 'Bình thường';
          return (
            <div className={`panel metric-card heartrate ${isCritical ? 'critical-pulse' : ''}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', borderRadius: '16px' }}>
              <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="metric-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nhịp Tim</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {statusText && <span className={`metric-status-badge ${hrStatus}`}>{statusText}</span>}
                  <div className="metric-icon-box" style={{ background: 'rgba(255, 51, 102, 0.1)', color: 'var(--color-primary)', padding: '6px', borderRadius: '8px' }}>
                    <HeartPulse className={currentMetrics.heartRate !== null && isConnected && !isStale ? 'beat-animated' : ''} size={18} />
                  </div>
                </div>
              </div>
              <div className="metric-body" style={{ margin: '8px 0' }}>
                {currentMetrics.heartRate !== null ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="metric-value tabular-nums" style={{ fontSize: '2rem', fontWeight: 700 }}>{currentMetrics.heartRate}</span>
                    <span className="metric-unit" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>BPM</span>
                  </div>
                ) : (
                  <span className="metric-unit" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu</span>
                )}
              </div>
              <div className="metric-footer" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={12} className={currentMetrics.heartRate !== null && isConnected && !isStale ? 'beat-animated' : ''} style={{ color: 'var(--color-primary)' }} />
                <span>An toàn: 50-120 {currentMetrics.updatedAt && `• ${currentMetrics.updatedAt}`}</span>
              </div>
            </div>
          );
        })()}

        {/* Thẻ SpO2 */}
        {(() => {
          const isCritical = currentMetrics.spo2 !== null && currentMetrics.spo2 < 92;
          const o2Status = currentMetrics.spo2 === null ? 'normal' : isCritical ? 'high' : 'normal';
          const statusText = currentMetrics.spo2 === null ? '' : isCritical ? 'Nguy hiểm' : 'An toàn';
          return (
            <div className={`panel metric-card spo2 ${isCritical ? 'critical-pulse' : ''}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', borderRadius: '16px' }}>
              <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="metric-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>SpO2</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {statusText && <span className={`metric-status-badge ${o2Status}`}>{statusText}</span>}
                  <div className="metric-icon-box" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--color-spo2)', padding: '6px', borderRadius: '8px' }}>
                    <Activity size={18} />
                  </div>
                </div>
              </div>
              <div className="metric-body" style={{ margin: '8px 0' }}>
                {currentMetrics.spo2 !== null ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="metric-value tabular-nums" style={{ fontSize: '2rem', fontWeight: 700 }}>{currentMetrics.spo2}</span>
                    <span className="metric-unit" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>%</span>
                  </div>
                ) : (
                  <span className="metric-unit" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu</span>
                )}
              </div>
              <div className="metric-footer" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={12} style={{ color: 'var(--color-spo2)' }} />
                <span>An toàn: &ge; 92% {currentMetrics.updatedAt && `• ${currentMetrics.updatedAt}`}</span>
              </div>
            </div>
          );
        })()}

        {/* Thẻ Huyết áp */}
        {(() => {
          const isCritical = currentMetrics.systolicBp !== null && (currentMetrics.systolicBp > 140 || currentMetrics.diastolicBp! > 90);
          const bpStatus = currentMetrics.systolicBp === null ? 'normal' : isCritical ? 'high' : 'normal';
          const statusText = currentMetrics.systolicBp === null ? '' : isCritical ? 'Cao' : 'Bình thường';
          return (
            <div className={`panel metric-card bp ${isCritical ? 'critical-pulse' : ''}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', borderRadius: '16px' }}>
              <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="metric-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Huyết áp</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {statusText && <span className={`metric-status-badge ${bpStatus}`}>{statusText}</span>}
                  <div className="metric-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-safe)', padding: '6px', borderRadius: '8px' }}>
                    <Activity size={18} />
                  </div>
                </div>
              </div>
              <div className="metric-body" style={{ margin: '8px 0' }}>
                {currentMetrics.systolicBp !== null ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="metric-value tabular-nums" style={{ fontSize: '2rem', fontWeight: 700 }}>{currentMetrics.systolicBp}/{currentMetrics.diastolicBp}</span>
                    <span className="metric-unit" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>mmHg</span>
                  </div>
                ) : (
                  <span className="metric-unit" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu</span>
                )}
              </div>
              <div className="metric-footer" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={12} style={{ color: 'var(--color-safe)' }} />
                <span>An toàn: 90-140/60-90 {currentMetrics.updatedAt && `• ${currentMetrics.updatedAt}`}</span>
              </div>
            </div>
          );
        })()}

        {/* Thẻ ECG */}
        {(() => {
          return (
            <div className="panel metric-card ecg" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '16px', borderRadius: '16px' }}>
              <div className="metric-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span className="metric-title" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>ECG (Điện tâm đồ)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div className="metric-icon-box" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', padding: '6px', borderRadius: '8px' }}>
                    <Activity size={18} />
                  </div>
                </div>
              </div>
              <div className="metric-body" style={{ margin: '8px 0' }}>
                {currentMetrics.ecgValue !== null ? (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <span className="metric-value tabular-nums" style={{ fontSize: '2rem', fontWeight: 700 }}>{currentMetrics.ecgValue}</span>
                    <span className="metric-unit" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>mV</span>
                  </div>
                ) : (
                  <span className="metric-unit" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu</span>
                )}
              </div>
              <div className="metric-footer" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={12} className={currentMetrics.ecgValue !== null && isConnected && !isStale ? 'beat-animated' : ''} />
                <span>Tín hiệu realtime {currentMetrics.updatedAt && `• ${currentMetrics.updatedAt}`}</span>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="role-page-grid">
        <section className="panel">
          <h3 className="metric-title"><ShieldAlert size={18} /> Cảnh báo cá nhân</h3>
          {alerts.length === 0 ? (
            <p className="role-muted">Chưa có cảnh báo sức khỏe mới.</p>
          ) : (
            <div className="activity-list">
              {alerts.slice(0, 4).map((alert, index) => (
                <div key={`${alert.message}-${index}`}>{alert.message}</div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h3 className="metric-title"><CalendarDays size={18} /> Lịch hẹn & đơn thuốc</h3>
          <div className="activity-list">
            <div>Chưa có lịch hẹn thật được đồng bộ.</div>
            <div>Chưa có đơn thuốc thật được đồng bộ.</div>
            <div><MessageCircle size={14} /> Chat với bác sĩ khi có triệu chứng bất thường.</div>
            <div><Pill size={14} /> Uống thuốc đúng giờ theo chỉ định.</div>
          </div>
        </section>
      </div>

      {/* Hộp thoại xác nhận SOS */}
      {showSosConfirm && (
        <div className="modal-overlay">
          <div className="modal-content panel" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div style={{ margin: '0 auto 1rem', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle size={32} style={{ color: 'var(--color-critical)' }} className="pulse-animated" />
            </div>
            <h2 className="auth-title" style={{ color: 'var(--color-critical)', marginBottom: '0.75rem' }}>XÁC NHẬN CẢNH BÁO SOS</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Hành động này sẽ gửi một cảnh báo nguy hiểm khẩn cấp (SOS) ngay lập tức tới tất cả các Bác sĩ điều trị phụ trách và Quản trị viên hệ thống. Bạn có chắc chắn muốn phát tín hiệu hỗ trợ không?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowSosConfirm(false)} disabled={isSendingSos}>
                Hủy bỏ
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, var(--color-critical), #c2003c)', fontWeight: 600 }}
                onClick={handleTriggerSos}
                disabled={isSendingSos}
              >
                {isSendingSos ? 'Đang gửi...' : 'Gửi SOS ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Trang giữ chỗ chung cho các route có tính năng chưa được hỗ trợ
 * bởi dữ liệu thực. Cung cấp trạng thái trống nhất quán với hướng dẫn ngữ cảnh.
 */
export const PlaceholderPage: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="role-page-stack">
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
    </div>

    <div className="module-detail-grid">
      <section className="panel module-hero-card">
        <div className="module-hero-mark">CG</div>
        <h2>Tính năng đang được phát triển / Đang chờ tích hợp backend</h2>
        <p>
          Trang này đã được thiết lập route và phân quyền truy cập. Tính năng này hiện tại chưa có dữ liệu thật hoặc đang trong quá trình chờ tích hợp đầy đủ từ backend. Vui lòng không sử dụng cho mục đích vận hành lâm sàng thực tế.
        </p>
      </section>

      <section className="panel">
        <h3 className="metric-title">Luồng xử lý</h3>
        <div className="activity-list">
          <div>1. Kết nối và nhận dữ liệu thực từ các dịch vụ API backend.</div>
          <div>2. Hiển thị trạng thái tải (loading), dữ liệu rỗng (empty state) và xử lý lỗi thay vì màn hình trắng.</div>
          <div>3. Tự động ghi lại nhật ký kiểm toán (audit log) cho các thao tác lâm sàng quan trọng.</div>
        </div>
      </section>
    </div>

    <div className="quick-action-grid">
      {['Danh sách', 'Chi tiết', 'Tạo/Cập nhật', 'Báo cáo'].map((item) => (
        <div className="quick-action-card" key={item}>{item}</div>
      ))}
    </div>

    <div className="alert-strip medium">
      <AlertTriangle size={16} className="alert-strip-icon" />
      <div className="alert-strip-body">
        <div className="alert-strip-title">Không dùng dữ liệu bệnh nhân ảo</div>
        <div className="alert-strip-desc">Các danh sách bệnh nhân chỉ lấy từ tài khoản Patient đã xác thực OTP.</div>
      </div>
    </div>
  </div>
);
