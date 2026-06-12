import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  HeartPulse,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  WifiOff,
  Droplets,
  Gauge
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getSeverityMeta } from '../utils/severity';
import type { Alert, SensorData } from '../types';

interface PatientHealthPageProps {
  latestTelemetry: SensorData | null;
  alerts: Alert[];
  isConnected?: boolean;
  navigate: (path: string, replace?: boolean) => void;
}

interface HealthHistoryPoint {
  heartRate: number;
  spo2: number;
  systolicBp: number;
  diastolicBp: number;
  ecgValue: number;
  timeLabel: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const formatTime = (value?: string | null) => {
  if (!value) return 'Chưa cập nhật';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

const renderTrendChart = (
  data: number[],
  color: string,
  gradId: string,
  minVal: number,
  maxVal: number
) => {
  const chartWidth = 520;
  const chartHeight = 170;
  const padX = 36;
  const padY = 22;

  if (data.length < 2) {
    return (
      <div
        style={{
          height: chartHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          border: '1px dashed var(--glass-border)',
          borderRadius: 16,
          background: 'rgba(255, 255, 255, 0.01)',
        }}
      >
        Chưa đủ dữ liệu để hiển thị xu hướng
      </div>
    );
  }

  const range = Math.max(maxVal - minVal, 1);
  const points = data.map((val, idx) => {
    const x = padX + (idx / (data.length - 1)) * (chartWidth - 2 * padX);
    const y = chartHeight - padY - ((val - minVal) / range) * (chartHeight - 2 * padY);
    return { x, y };
  });

  const pathD = `M ${points[0].x} ${points[0].y} ${points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ')}`;
  const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - padY} L ${points[0].x} ${chartHeight - padY} Z`;

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="svg-chart" style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((ratio, index) => {
        const y = padY + ratio * (chartHeight - 2 * padY);
        const gridVal = Math.round(maxVal - ratio * range);
        return (
          <g key={index}>
            <line x1={padX} y1={y} x2={chartWidth - padX} y2={y} stroke="rgba(255, 255, 255, 0.05)" />
            <text x={padX - 8} y={y + 4} fill="var(--text-muted)" fontSize="8" textAnchor="end">
              {gridVal}
            </text>
          </g>
        );
      })}

      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="3.25"
          fill="var(--bg-secondary)"
          stroke={color}
          strokeWidth="1.6"
        />
      ))}
    </svg>
  );
};

const getMetricTone = (value: number | null, type: 'heartRate' | 'spo2' | 'bp' | 'ecg') => {
  if (value === null) {
    return { status: 'waiting', label: 'Chờ dữ liệu', detail: 'Chưa có tín hiệu realtime' };
  }

  if (type === 'heartRate') {
    if (value < 50) return { status: 'high', label: 'Nhịp chậm', detail: 'Cần theo dõi thêm' };
    if (value > 120) return { status: 'high', label: 'Nhịp nhanh', detail: 'Theo dõi ngay' };
    return { status: 'normal', label: 'Bình thường', detail: 'Trong ngưỡng an toàn' };
  }

  if (type === 'spo2') {
    if (value < 92) return { status: 'critical', label: 'SpO2 thấp', detail: 'Không nên bỏ qua' };
    if (value < 95) return { status: 'warning', label: 'Theo dõi', detail: 'Chưa đạt mức tối ưu' };
    return { status: 'normal', label: 'Bình thường', detail: 'Trong ngưỡng an toàn' };
  }

  if (type === 'bp') {
    return { status: 'normal', label: 'Đã cập nhật', detail: 'Xem cùng nhịp tim và SpO2' };
  }

  if (type === 'ecg') {
    return { status: 'low', label: 'Tín hiệu sống', detail: 'Quan sát xu hướng ECG' };
  }

  return { status: 'normal', label: 'Bình thường', detail: 'Trong ngưỡng an toàn' };
};

export const PatientHealthPage: React.FC<PatientHealthPageProps> = ({ latestTelemetry, alerts, isConnected = false, navigate }) => {
  const { user } = useAuth();
  const [history, setHistory] = useState<HealthHistoryPoint[]>([]);

  const patientId = latestTelemetry?.patient_id || user?.id || '';
  const hasTelemetry = Boolean(latestTelemetry && (!user?.id || latestTelemetry.patient_id === user.id));

  useEffect(() => {
    setHistory([]);
  }, [patientId]);

  useEffect(() => {
    if (!hasTelemetry || !latestTelemetry) return;

    const now = new Date();
    const timeLabel = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setHistory((prev) => {
      const next = [
        ...prev,
        {
          heartRate: latestTelemetry.heart_rate,
          spo2: latestTelemetry.spo2,
          systolicBp: latestTelemetry.systolic_bp,
          diastolicBp: latestTelemetry.diastolic_bp,
          ecgValue: latestTelemetry.ecg_value,
          timeLabel,
        },
      ];
      if (next.length > 16) next.shift();
      return next;
    });
  }, [hasTelemetry, latestTelemetry]);

  const displayedTelemetry = hasTelemetry ? latestTelemetry : null;
  const patientAlerts = useMemo(() => {
    return alerts
      .filter((alert) => patientId ? alert.patient_id === patientId : false)
      .slice()
      .sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [alerts, patientId]);

  const recentAlert = patientAlerts[0] || null;
  const lastUpdate = history[history.length - 1]?.timeLabel || formatTime(displayedTelemetry?.timestamp);

  const heartRate = displayedTelemetry?.heart_rate ?? null;
  const spo2 = displayedTelemetry?.spo2 ?? null;
  const systolicBp = displayedTelemetry?.systolic_bp ?? null;
  const diastolicBp = displayedTelemetry?.diastolic_bp ?? null;
  const ecgValue = displayedTelemetry?.ecg_value ?? null;

  const heartRateTone = getMetricTone(heartRate, 'heartRate');
  const spo2Tone = getMetricTone(spo2, 'spo2');
  const bpTone = getMetricTone(systolicBp, 'bp');
  const ecgTone = getMetricTone(ecgValue, 'ecg');

  const hasHrIssue = heartRate !== null && (heartRate < 50 || heartRate > 120);
  const hasSpo2Issue = spo2 !== null && spo2 < 95;
  const hasBpIssue = systolicBp !== null && diastolicBp !== null && (systolicBp >= 140 || diastolicBp >= 90 || systolicBp < 90 || diastolicBp < 60);
  const hasEcgIssue = Boolean(displayedTelemetry?.is_abnormal);
  const hasHighAlert = patientAlerts.some((alert) => {
    const severity = getSeverityMeta(alert.severity).key;
    return severity === 'critical' || severity === 'high';
  });

  let healthScore = displayedTelemetry ? 100 : 0;
  if (hasHrIssue) healthScore -= 18;
  if (hasSpo2Issue) healthScore -= spo2 !== null && spo2 < 92 ? 24 : 10;
  if (hasBpIssue) healthScore -= 15;
  if (hasEcgIssue) healthScore -= 10;
  if (hasHighAlert) healthScore -= 12;
  healthScore = clamp(healthScore, 0, 100);

  const healthLabel = displayedTelemetry
    ? healthScore >= 80
      ? 'Ổn định'
      : healthScore >= 60
        ? 'Cần theo dõi'
        : 'Cảnh báo'
    : 'Chưa có dữ liệu';

  const healthTone = displayedTelemetry
    ? healthScore >= 80
      ? 'normal'
      : healthScore >= 60
        ? 'warning'
        : 'high'
    : 'waiting';

  const quickActions = [
    { label: 'Bệnh án điện tử', path: '/patient/medical-records', icon: FileText, description: 'Xem bệnh án đã ký xác nhận' },
    { label: 'Chat với bác sĩ', path: '/patient/chat', icon: MessageCircle, description: 'Trao đổi khi có triệu chứng' },
    { label: 'Lịch hẹn', path: '/patient/appointments', icon: CalendarDays, description: 'Theo dõi các buổi khám' },
    { label: 'Cài đặt', path: '/patient/settings', icon: RefreshCw, description: 'Thông báo, bảo mật và giao diện' },
  ];

  const trendRows = history.slice(-5).reverse();

  return (
    <div className="role-page-stack">
      <section
        className="panel"
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '28px',
          minHeight: 260,
          background: `
            radial-gradient(circle at 14% 18%, rgba(239, 68, 68, 0.18), transparent 30%),
            radial-gradient(circle at 86% 14%, rgba(14, 165, 233, 0.16), transparent 28%),
            linear-gradient(135deg, rgba(9, 10, 14, 0.98), rgba(12, 16, 28, 0.92))
          `,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ maxWidth: 820 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid var(--glass-border)',
                background: 'rgba(255, 255, 255, 0.03)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <Sparkles size={14} />
              Theo dõi realtime
            </div>
            <h2 style={{ margin: '14px 0 14px', fontSize: 'clamp(2rem, 3.5vw, 3.35rem)', lineHeight: 1.04, letterSpacing: '-0.04em', fontWeight: 900 }}>
              Bảng điều khiển sức khỏe cá nhân
            </h2>
            <p style={{ maxWidth: 760, color: 'var(--text-secondary)', fontSize: '1.06rem', lineHeight: 1.75, marginBottom: 18 }}>
              Theo dõi nhịp tim, SpO2, huyết áp và ECG từ nguồn realtime. Các chỉ số bên dưới là dữ liệu tham khảo lâm sàng, đi cùng với cảnh báo gần đây và lối tắt liên hệ bác sĩ.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <span className={`connection-badge ${isConnected ? 'live' : 'offline'}`}>
                {isConnected ? 'Trực tuyến' : 'Ngoại tuyến'}
              </span>
              <span className={`connection-badge ${displayedTelemetry ? 'live' : 'waiting'}`}>
                {displayedTelemetry ? 'Đã nhận dữ liệu realtime' : 'Đang chờ tín hiệu'}
              </span>
              <span className={`connection-badge ${healthTone}`}>
                Điểm theo dõi: {healthScore}/100
              </span>
              <span className="connection-badge waiting">
                Cập nhật gần nhất: {lastUpdate}
              </span>
            </div>
          </div>

          <div
            style={{
              minWidth: 250,
              flex: '0 0 250px',
              padding: 18,
              borderRadius: 24,
              border: '1px solid var(--glass-border)',
              background: 'rgba(255, 255, 255, 0.03)',
              boxShadow: '0 18px 48px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Kết luận tham khảo
              </span>
              {isConnected ? (
                <ShieldCheck size={18} style={{ color: 'var(--color-safe)' }} />
              ) : (
                <WifiOff size={18} style={{ color: 'var(--color-warning)' }} />
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 900, lineHeight: 1, marginBottom: 8 }}>
              {healthScore}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: 8 }}>{healthLabel}</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6, margin: 0 }}>
              {displayedTelemetry
                ? 'Không dùng để chẩn đoán thay cho bác sĩ. Nếu có triệu chứng bất thường, hãy liên hệ ngay.'
                : 'Chưa có tín hiệu realtime để đánh giá xu hướng hiện tại.'}
            </p>
          </div>
        </div>

        {recentAlert ? (
          <div className="alert-strip medium" style={{ marginTop: 18, marginBottom: 0 }}>
            <AlertTriangle size={16} className="alert-strip-icon" />
            <div className="alert-strip-body">
              <div className="alert-strip-title">Cảnh báo gần nhất</div>
              <div className="alert-strip-desc">{recentAlert.message}</div>
            </div>
          </div>
        ) : (
          <div className="alert-strip low" style={{ marginTop: 18, marginBottom: 0 }}>
            <ShieldCheck size={16} className="alert-strip-icon" />
            <div className="alert-strip-body">
              <div className="alert-strip-title">Không có cảnh báo mới</div>
              <div className="alert-strip-desc">Hệ thống hiện chưa ghi nhận cảnh báo nào cho tài khoản bệnh nhân này.</div>
            </div>
          </div>
        )}
      </section>

      <div className="role-stat-grid">
        <div className="panel metric-card heartrate">
          <div className="metric-header">
            <span className="metric-title">Nhịp tim</span>
            <div className="metric-header-right">
              <span className={`metric-status-badge ${heartRateTone.status}`}>{heartRateTone.label}</span>
              <div className="metric-icon-box">
                <HeartPulse size={20} />
              </div>
            </div>
          </div>
          <div className="metric-body">
            {heartRate !== null ? (
              <>
                <span className="metric-value tabular-nums">{heartRate}</span>
                <span className="metric-unit">BPM</span>
              </>
            ) : (
              <>
                <span className="metric-value tabular-nums metric-value--muted">--</span>
                <span className="metric-unit">BPM</span>
              </>
            )}
          </div>
          <div className="metric-footer">
            <Clock3 size={12} style={{ color: 'var(--color-primary)' }} />
            <span className="metric-range">Ngưỡng an toàn: 50 - 120 BPM</span>
          </div>
        </div>

        <div className="panel metric-card spo2">
          <div className="metric-header">
            <span className="metric-title">SpO2</span>
            <div className="metric-header-right">
              <span className={`metric-status-badge ${spo2Tone.status}`}>{spo2Tone.label}</span>
              <div className="metric-icon-box">
                <Droplets size={20} />
              </div>
            </div>
          </div>
          <div className="metric-body">
            {spo2 !== null ? (
              <>
                <span className="metric-value tabular-nums">{spo2}</span>
                <span className="metric-unit">%</span>
              </>
            ) : (
              <>
                <span className="metric-value tabular-nums metric-value--muted">--</span>
                <span className="metric-unit">%</span>
              </>
            )}
          </div>
          <div className="metric-footer">
            <Clock3 size={12} style={{ color: 'var(--color-spo2)' }} />
            <span className="metric-range">Ngưỡng an toàn: &ge; 95%</span>
          </div>
        </div>

        <div className="panel metric-card bp">
          <div className="metric-header">
            <span className="metric-title">Huyết áp</span>
            <div className="metric-header-right">
              <span className={`metric-status-badge ${bpTone.status}`}>{bpTone.label}</span>
              <div className="metric-icon-box">
                <Gauge size={20} />
              </div>
            </div>
          </div>
          <div className="metric-body">
            {systolicBp !== null && diastolicBp !== null ? (
              <>
                <span className="metric-value bp-value tabular-nums">
                  {systolicBp}/{diastolicBp}
                </span>
                <span className="metric-unit">mmHg</span>
              </>
            ) : (
              <>
                <span className="metric-value bp-value tabular-nums metric-value--muted">--/--</span>
                <span className="metric-unit">mmHg</span>
              </>
            )}
          </div>
          <div className="metric-footer">
            <Clock3 size={12} style={{ color: 'var(--color-bp)' }} />
            <span className="metric-range">Ngưỡng an toàn: 90/60 - 140/90</span>
          </div>
        </div>

        <div className="panel metric-card ecg">
          <div className="metric-header">
            <span className="metric-title">ECG</span>
            <div className="metric-header-right">
              <span className={`metric-status-badge ${ecgTone.status}`}>{ecgTone.label}</span>
              <div className="metric-icon-box">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>
          <div className="metric-body">
            {ecgValue !== null ? (
              <>
                <span className="metric-value tabular-nums">{ecgValue}</span>
                <span className="metric-unit">mV</span>
              </>
            ) : (
              <>
                <span className="metric-value tabular-nums metric-value--muted">--</span>
                <span className="metric-unit">mV</span>
              </>
            )}
          </div>
          <div className="metric-footer">
            <Clock3 size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="metric-range">Quan sát xu hướng tín hiệu điện tim</span>
          </div>
        </div>
      </div>

      <div className="chart-panel-grid">
        <section className="panel">
          <div className="ecg-panel-header">
            <h3 className="ecg-panel-title">
              <Activity size={18} className={hasTelemetry ? 'beat-animated' : ''} style={{ color: 'var(--color-primary)' }} />
              Diễn biến gần đây
            </h3>
            <div className="ecg-panel-meta">
              <span className="ecg-status-badge">
                {history.length > 1 ? `${history.length} điểm gần nhất` : 'Đang chờ thêm dữ liệu'}
              </span>
              <span className="tabular-nums" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                {displayedTelemetry ? `${displayedTelemetry.heart_rate} BPM` : '--'}
              </span>
            </div>
          </div>

          <div className="chart-legend" style={{ marginTop: 0, marginBottom: 16 }}>
            <div className="legend-item">
              <span className="legend-color-dot" style={{ background: 'var(--color-primary)' }} />
              Nhịp tim
            </div>
            <div className="legend-item">
              <span className="legend-color-dot" style={{ background: 'var(--color-spo2)' }} />
              SpO2
            </div>
          </div>

          <div className="chart-panel-grid" style={{ marginBottom: 0, gridTemplateColumns: '1fr', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="metric-title" style={{ color: 'var(--color-primary)' }}>Nhịp tim</span>
                <span className="metric-range">Mốc an toàn: 50 - 120 BPM</span>
              </div>
              <div className="svg-chart-container">{renderTrendChart(history.map((item) => item.heartRate), 'var(--color-primary)', 'patient-health-hr', 40, 150)}</div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="metric-title" style={{ color: 'var(--color-spo2)' }}>SpO2</span>
                <span className="metric-range">Mốc an toàn: &ge; 95%</span>
              </div>
              <div className="svg-chart-container">{renderTrendChart(history.map((item) => item.spo2), 'var(--color-spo2)', 'patient-health-spo2', 80, 100)}</div>
            </div>
          </div>
        </section>

        <section className="panel">
          <h3 className="metric-title" style={{ marginBottom: 12 }}>
            <Stethoscope size={18} /> Tổng quan lâm sàng
          </h3>

          <div className="activity-list" style={{ gap: 12 }}>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Kết nối:</strong>{' '}
              {isConnected ? 'Đang nhận realtime' : 'Ngoại tuyến hoặc chưa kết nối'}
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Cập nhật:</strong>{' '}
              {lastUpdate}
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Cảnh báo:</strong>{' '}
              {patientAlerts.length} bản ghi gần nhất
            </div>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>ECG:</strong>{' '}
              {displayedTelemetry?.is_abnormal ? 'Có dấu hiệu bất thường' : 'Chưa ghi nhận bất thường'}
            </div>
          </div>

          <div style={{ marginTop: 18, padding: 16, borderRadius: 18, border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="metric-title" style={{ marginBottom: 4 }}>Lối tắt</div>
                <div className="role-muted">Đi tới các màn hỗ trợ lâm sàng thường dùng.</div>
              </div>
              <Sparkles size={18} style={{ color: 'var(--color-warning)' }} />
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.path}
                    type="button"
                    className="quick-action-card"
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 14,
                    }}
                    onClick={() => navigate(action.path)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div className="role-stat-icon" style={{ width: 38, height: 38, flexShrink: 0 }}>
                        <Icon size={18} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 850, color: 'var(--text-primary)' }}>{action.label}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{action.description}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      <div className="module-detail-grid">
        <section className="panel">
          <h3 className="metric-title" style={{ marginBottom: 12 }}>
            <AlertTriangle size={18} /> Cảnh báo gần đây
          </h3>

          {patientAlerts.length === 0 ? (
            <div className="alert-strip low">
              <ShieldCheck size={16} className="alert-strip-icon" />
              <div className="alert-strip-body">
                <div className="alert-strip-title">Không có cảnh báo mới</div>
                <div className="alert-strip-desc">Khi có bất thường, hệ thống sẽ ghi lại ở đây và đồng bộ cho bác sĩ phụ trách.</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
              {patientAlerts.slice(0, 6).map((alert, index) => {
                const severityMeta = getSeverityMeta(alert.severity);
                const AlertIcon = severityMeta.icon;

                return (
                  <div
                    key={alert.id || `${alert.message}-${index}`}
                    className={`alert-strip ${severityMeta.key}`}
                    style={{
                      borderLeft: `3px solid ${severityMeta.colorVar}`,
                      background: severityMeta.bgVar,
                    }}
                  >
                    <AlertIcon className="alert-strip-icon" size={16} style={{ color: severityMeta.colorVar }} />
                    <div className="alert-strip-body">
                      <div className="alert-strip-title" style={{ color: severityMeta.colorVar, fontWeight: severityMeta.weight }}>
                        {alert.alert_type}
                      </div>
                      <div className="alert-strip-desc">{alert.message}</div>
                      <div className="alert-strip-time tabular-nums">
                        {alert.created_at ? new Date(alert.created_at).toLocaleString('vi-VN') : 'Vừa xong'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <h3 className="metric-title" style={{ marginBottom: 12 }}>
            <Clock3 size={18} /> Nhật ký cập nhật gần nhất
          </h3>

          {trendRows.length === 0 ? (
            <div className="activity-list">
              <div>Chưa có dữ liệu lịch sử để hiển thị.</div>
              <div>Hệ thống sẽ bắt đầu ghi mốc khi có tín hiệu realtime đầu tiên.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {trendRows.map((item) => (
                <div key={`${item.timeLabel}-${item.heartRate}`} className="activity-list">
                  <div>
                    <strong style={{ color: 'var(--text-primary)' }}>{item.timeLabel}</strong>
                    <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, color: 'var(--text-secondary)' }}>
                      <span>HR: {item.heartRate} BPM</span>
                      <span>SpO2: {item.spo2}%</span>
                      <span>BP: {item.systolicBp}/{item.diastolicBp} mmHg</span>
                      <span>ECG: {item.ecgValue} mV</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="alert-strip medium" style={{ marginTop: 18 }}>
            <AlertTriangle size={16} className="alert-strip-icon" />
            <div className="alert-strip-body">
              <div className="alert-strip-title">Lưu ý lâm sàng</div>
              <div className="alert-strip-desc">
                Trang này chỉ dùng để theo dõi và tham khảo. Mọi quyết định điều trị cần bác sĩ xác nhận.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
