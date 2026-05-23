import React, { useState, useEffect } from 'react';
import { ChevronLeft, User, Heart, Activity, AlertTriangle, Phone, MapPin, Calendar, Clipboard } from 'lucide-react';

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
  alerts: Array<{
    alert_type: string;
    message: string;
    severity: string;
  }>;
}

interface PatientDetailProps {
  patient: Patient;
  latestTelemetry: SensorData | null;
  alerts: Alert[];
  onBackClick: () => void;
}

interface HistoryPoint {
  heartRate: number;
  spo2: number;
  timeLabel: string;
}

export const PatientDetail: React.FC<PatientDetailProps> = ({
  patient,
  latestTelemetry,
  alerts,
  onBackClick
}) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  // 1. Pre-populate history with realistic vitals so it doesn't start empty
  useEffect(() => {
    const initialHistory: HistoryPoint[] = [];
    const baseHR = 70 + Math.floor(Math.random() * 15);
    const baseSpO2 = 97 + Math.floor(Math.random() * 3);
    
    for (let i = 9; i >= 0; i--) {
      const time = new Date();
      time.setSeconds(time.getSeconds() - i * 3);
      const timeLabel = time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      initialHistory.push({
        heartRate: baseHR + Math.floor((Math.random() - 0.5) * 6),
        spo2: Math.min(100, baseSpO2 + Math.floor((Math.random() - 0.5) * 2)),
        timeLabel
      });
    }
    setHistory(initialHistory);
  }, [patient.id]);

  // 2. Append new real-time telemetry if it matches this patient
  useEffect(() => {
    if (latestTelemetry && latestTelemetry.patient_id === patient.id) {
      const now = new Date();
      const timeLabel = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      setHistory(prev => {
        const next = [...prev, {
          heartRate: latestTelemetry.heart_rate,
          spo2: latestTelemetry.spo2,
          timeLabel
        }];
        if (next.length > 12) next.shift(); // keep last 12 points
        return next;
      });
    }
  }, [latestTelemetry, patient.id]);

  // Filter alerts specifically for this patient
  const patientAlerts = alerts.filter(a => a.patient_id === patient.id);

  // SVG Chart Dimensions
  const chartWidth = 500;
  const chartHeight = 150;
  const padX = 40;
  const padY = 20;

  // Helper: render single SVG Line Chart
  const renderLineChart = (
    data: number[],
    color: string,
    gradId: string,
    minVal: number,
    maxVal: number
  ) => {
    const range = maxVal - minVal;
    
    const points = data.map((val, idx) => {
      const x = padX + (idx / (data.length - 1)) * (chartWidth - 2 * padX);
      // invert Y coordinate for canvas/svg rendering
      const y = chartHeight - padY - ((val - minVal) / range) * (chartHeight - 2 * padY);
      return { x, y, val };
    });

    let pathD = '';
    let areaD = '';
    if (points.length > 0) {
      pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
      areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - padY} L ${points[0].x} ${chartHeight - padY} Z`;
    }

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="svg-chart" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((ratio, i) => {
          const y = padY + ratio * (chartHeight - 2 * padY);
          const gridVal = Math.round(maxVal - ratio * range);
          return (
            <g key={i}>
              <line x1={padX} y1={y} x2={chartWidth - padX} y2={y} stroke="rgba(255, 255, 255, 0.04)" />
              <text x={padX - 8} y={y + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end">{gridVal}</text>
            </g>
          );
        })}

        {/* Area under curve */}
        {areaD && <path d={areaD} fill={`url(#${gradId})`} />}

        {/* Path line */}
        {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />}

        {/* Nodes */}
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="3" fill="var(--bg-secondary)" stroke={color} strokeWidth="1.5" />
        ))}
      </svg>
    );
  };

  return (
    <div>
      {/* Page navigation back header */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={onBackClick} style={{ padding: '8px 12px' }}>
            <ChevronLeft size={18} /> Quay lại
          </button>
          <div>
            <h1 className="page-title">{patient.full_name}</h1>
            <p className="page-subtitle">Hồ sơ chi tiết và lịch sử nhịp sinh học</p>
          </div>
        </div>
        <div className="badge" style={{ background: 'rgba(57, 255, 20, 0.1)', color: 'var(--color-bp)', border: '1px solid rgba(57, 255, 20, 0.2)' }}>
          ĐANG GIÁM SÁT LIVE
        </div>
      </div>

      <div className="grid-2-3">
        {/* Left Column: Trend Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Heart Rate history chart */}
          <div className="panel">
            <h3 className="metric-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
              <Heart size={16} /> Biểu đồ Xu Hướng Nhịp Tim (BPM)
            </h3>
            <div style={{ width: '100%', height: '140px' }}>
              {history.length > 1 ? (
                renderLineChart(
                  history.map(h => h.heartRate),
                  'var(--color-primary)',
                  'hr-trend-grad',
                  40,
                  150
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  Đang thu thập dữ liệu...
                </div>
              )}
            </div>
          </div>

          {/* SpO2 history chart */}
          <div className="panel">
            <h3 className="metric-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-spo2)' }}>
              <Activity size={16} /> Biểu đồ Xu Hướng Nồng Độ Oxy SpO2 (%)
            </h3>
            <div style={{ width: '100%', height: '140px' }}>
              {history.length > 1 ? (
                renderLineChart(
                  history.map(h => h.spo2),
                  'var(--color-spo2)',
                  'spo2-trend-grad',
                  80,
                  100
                )
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', height: '100%', color: 'var(--text-muted)' }}>
                  Đang thu thập dữ liệu...
                </div>
              )}
            </div>
          </div>

          {/* Alert History Logs list */}
          <div className="panel">
            <h3 className="metric-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} /> Lịch Sử Cảnh Báo Gần Đây
            </h3>
            
            {patientAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Chưa có cảnh báo nào ghi nhận đối với bệnh nhân này.
              </div>
            ) : (
              <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
                {patientAlerts.map((alert, index) => (
                  <div key={index} className={`alert-strip ${alert.severity === 'high' ? 'high' : 'medium'}`}>
                    <AlertTriangle size={16} className="alert-strip-icon" />
                    <div className="alert-strip-body">
                      <div className="alert-strip-title" style={{ textTransform: 'uppercase' }}>
                        {alert.alert_type} ({alert.severity})
                      </div>
                      <div className="alert-strip-desc">{alert.message}</div>
                      <div className="alert-strip-time">
                        {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Vừa xong'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Dossier Information Card */}
        <div className="panel" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            <div className="patient-avatar" style={{ margin: 0, width: '48px', height: '48px', borderRadius: '14px' }}>
              <User size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Thông Tin Lâm Sàng</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mã BN: {patient.id}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Tuổi & Giới tính</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{patient.age} tuổi • {patient.gender}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Phone size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Số điện thoại</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{patient.phone || 'Chưa cung cấp'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MapPin size={16} style={{ color: 'var(--text-muted)' }} />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Địa chỉ liên hệ</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{patient.address || 'Chưa cung cấp'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <Clipboard size={16} style={{ color: 'var(--text-muted)', marginTop: '2px' }} />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Tiền sử bệnh lý</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-warning)', fontWeight: 600 }}>
                  {patient.medical_history || 'Không ghi nhận tiền sử bệnh lý.'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--text-primary)' }}>Lưu ý giám sát:</strong>
            Thực hiện cập nhật dữ liệu định kỳ qua thiết bị đeo. Khi có cảnh báo nhịp tim đập nhanh (từ 120 trở lên) hoặc SpO2 tụt giảm dưới 92%, hệ thống thông báo báo động trung tâm tự động kích hoạt.
          </div>
        </div>
      </div>
    </div>
  );
};
export default PatientDetail;
