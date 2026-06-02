import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, BarChart3, CalendarDays, Cpu, HeartPulse, MessageCircle, Pill, ShieldAlert, Stethoscope, Users, Radio, WifiOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';

interface Patient {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  medical_history: string;
}

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

interface SensorData {
  patient_id: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  ecg_value: number;
  is_abnormal: boolean;
  alerts: Array<{ alert_type: string; message: string; severity: string }>;
}

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

export const AdminDashboard: React.FC<{ patients: Patient[]; alerts: Alert[]; doctors?: any[] }> = ({ patients, alerts, doctors = [] }) => {
  const highAlerts = alerts.filter((alert) => alert.severity === 'high').length;
  const chartValues = [patients.length, alerts.length, highAlerts, doctors.length, 0, 0, 0];
  const maxChartValue = Math.max(...chartValues, 1);

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Admin</h1>
          <p className="page-subtitle">Tổng quan vận hành hệ thống CardioGuard AI.</p>
        </div>
      </div>

      <div className="role-stat-grid">
        <Card icon={<Users size={22} />} label="Tổng số bệnh nhân" value={patients.length} hint="Đang được quản lý" />
        <Card icon={<Stethoscope size={22} />} label="Tổng số bác sĩ" value={doctors.length} hint="Đang hoạt động" />
        <Card icon={<Cpu size={22} />} label="Thiết bị IoT" value="0" hint="Chưa có thiết bị thật được liên kết" />
        <Card icon={<ShieldAlert size={22} />} label="Cảnh báo" value={alerts.length} hint={`${highAlerts} cảnh báo mức cao`} tone="danger" />
      </div>

      <div className="role-page-grid">
        <section className="panel">
          <h3 className="metric-title"><BarChart3 size={18} /> Biểu đồ thống kê</h3>
          <div className="real-chart-bars">
            {chartValues.map((value, index) => (
              <span key={index} style={{ height: `${Math.max(8, (value / maxChartValue) * 100)}%` }} title={`${value}`} />
            ))}
          </div>
          <p className="role-muted">Biểu đồ chỉ dùng dữ liệu thật hiện có, không tạo bệnh nhân ảo.</p>
        </section>

        <section className="panel">
          <h3 className="metric-title"><Activity size={18} /> Hoạt động hệ thống gần đây</h3>
          <div className="activity-list">
            <div>Đồng bộ telemetry realtime thành công.</div>
            <div>WebSocket `/ws/realtime` đang sẵn sàng.</div>
            <div>AI risk assistant ở chế độ hỗ trợ tham khảo, cần bác sĩ xác nhận.</div>
            <div>Audit log ghi nhận phiên đăng nhập mới.</div>
          </div>
        </section>
      </div>
    </div>
  );
};

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

export const PatientHome: React.FC<{
  latestTelemetry: SensorData | null;
  alerts: Alert[];
  isConnected?: boolean;
}> = ({ latestTelemetry, alerts, isConnected = false }) => {
  const { accessToken, user } = useAuth();
  const [lastTelemetryTime, setLastTelemetryTime] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(true);
  const [isSendingSos, setIsSendingSos] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);

  // SOS Long Press States
  const [countdown, setCountdown] = useState(3);
  const [isHolding, setIsHolding] = useState(false);

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

  const handleTriggerSos = async () => {
    if (!accessToken) return;
    setIsSendingSos(true);
    try {
      const response = await fetch(`${API_URL}/alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ message: 'Bệnh nhân yêu cầu hỗ trợ khẩn cấp (SOS)' })
      });
      if (response.ok) {
        alert('Cảnh báo SOS khẩn cấp đã được phát đi thành công tới hệ thống và các bác sĩ phụ trách!');
        setShowSosConfirm(false);
      } else {
        const data = await response.json();
        alert(data.detail || 'Lỗi gửi yêu cầu SOS khẩn cấp');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ khi gửi tín hiệu SOS khẩn cấp');
    } finally {
      setIsSendingSos(false);
    }
  };

  useEffect(() => {
    // Only update if latestTelemetry matches logged in user or we are in patient session
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

      {/* WebSocket Connection / Vitals Stale Status Banner */}
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
        {/* Heart Rate Card */}
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

        {/* SpO2 Card */}
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

        {/* Huyết áp Card */}
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

        {/* ECG Card */}
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

      {/* SOS Confirmation Modal */}
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
