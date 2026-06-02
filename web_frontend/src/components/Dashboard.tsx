import React, { useState, useEffect, useRef } from 'react';
import { Heart, Activity, AlertTriangle, User, Play, Radio, Plus, Clock } from 'lucide-react';
import { ECGChart } from './ECGChart';
import { BeatingHeart3D } from './BeatingHeart3D';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';
import { getSeverityMeta } from '../utils/severity';
import { Patient, Alert, SensorData } from '../types';

interface DashboardProps {
  patients: Patient[];
  latestTelemetry: SensorData | null;
  alerts: Alert[];
  onAddPatientClick: () => void;
  isConnected?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  patients, 
  latestTelemetry, 
  alerts,
  onAddPatientClick,
  isConnected = false
}) => {
  const { accessToken } = useAuth();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastTelemetryTime, setLastTelemetryTime] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(true);

  // Derived UI states for clinical realtime tracking
  const hasTelemetryForSelectedPatient = latestTelemetry?.patient_id === selectedPatientId;
  const isRealtimeActive = hasTelemetryForSelectedPatient && !isStale;
  const metricsSourceLabel = hasTelemetryForSelectedPatient ? 'Cảm biến realtime (WebSocket)' : 'Chờ tín hiệu kết nối từ thiết bị đeo';

  const getAlertSeverityClass = (severity: string) => {
    const s = severity?.toLowerCase() || '';
    if (s === 'critical') return 'critical';
    if (s === 'high') return 'high';
    if (s === 'warning' || s === 'medium') return 'warning';
    if (s === 'low' || s === 'info') return 'low';
    return 'low';
  };

  const getAlertSeverityLabel = (severity: string) => {
    const s = severity?.toLowerCase() || '';
    if (s === 'critical') return 'Nguy kịch';
    if (s === 'high') return 'Nghiêm trọng';
    if (s === 'warning' || s === 'medium') return 'Cảnh báo';
    if (s === 'low' || s === 'info') return 'Theo dõi';
    return 'Chưa phân loại';
  };
  
  // Clinical Metric State: Initialize all values as null when there is no telemetry
  const [currentMetrics, setCurrentMetrics] = useState<{
    heartRate: number | null;
    spo2: number | null;
    systolicBp: number | null;
    diastolicBp: number | null;
    ecgValue: number | null;
    isAbnormal: boolean;
    alerts: Array<{
      alert_type: string;
      message: string;
      severity: string;
    }>;
    updatedAt: string | null;
  }>({
    heartRate: null,
    spo2: null,
    systolicBp: null,
    diastolicBp: null,
    ecgValue: null,
    isAbnormal: false,
    alerts: [],
    updatedAt: null
  });

  // Select the first patient automatically if none selected
  useEffect(() => {
    if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

  // Reset metrics when changing patient to prevent displaying cross-patient stale data
  useEffect(() => {
    setCurrentMetrics({
      heartRate: null,
      spo2: null,
      systolicBp: null,
      diastolicBp: null,
      ecgValue: null,
      isAbnormal: false,
      alerts: [],
      updatedAt: null
    });
    setLastTelemetryTime(null);
    setIsStale(true);
  }, [selectedPatientId]);

  // Update current metrics when websocket feeds telemetry for selected patient
  useEffect(() => {
    if (latestTelemetry && latestTelemetry.patient_id === selectedPatientId) {
      setCurrentMetrics({
        heartRate: latestTelemetry.heart_rate,
        spo2: latestTelemetry.spo2,
        systolicBp: latestTelemetry.systolic_bp,
        diastolicBp: latestTelemetry.diastolic_bp,
        ecgValue: latestTelemetry.ecg_value,
        isAbnormal: latestTelemetry.is_abnormal,
        alerts: latestTelemetry.alerts,
        updatedAt: new Date().toLocaleTimeString('vi-VN')
      });
      setLastTelemetryTime(new Date());
      setIsStale(false);
    }
  }, [latestTelemetry, selectedPatientId]);

  // Telemetry stale state: check if gap exceeds 30 seconds
  const lastTelemetryTimeRef = useRef<Date | null>(null);
  useEffect(() => {
    lastTelemetryTimeRef.current = lastTelemetryTime;
  }, [lastTelemetryTime]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastTelemetryTimeRef.current) {
        const diffSeconds = (new Date().getTime() - lastTelemetryTimeRef.current.getTime()) / 1000;
        setIsStale(diffSeconds > 30);
      } else {
        setIsStale(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Find details of the active patient
  const activePatient = patients.find(p => p.id === selectedPatientId);

  // Filter alerts for the selected patient
  const activePatientAlerts = alerts.filter(a => a.patient_id === selectedPatientId);

  // Generate and send simulated telemetry to test backend and websocket pipeline
  const handleSimulateTelemetry = async (abnormal = false) => {
    if (!selectedPatientId) return;
    setIsSimulating(true);

    // Generate random values
    let hr = Math.floor(Math.random() * (100 - 60) + 60); // 60 - 100 normal
    let o2 = Math.floor(Math.random() * (100 - 95) + 95); // 95 - 100 normal
    let sys = Math.floor(Math.random() * (135 - 110) + 110); // 110 - 135 normal
    let dia = Math.floor(Math.random() * (85 - 70) + 70); // 70 - 85 normal
    const ecg = (Math.random() - 0.5) * 0.3; // tiny baseline

    if (abnormal) {
      // Trigger abnormal readings
      const rand = Math.random();
      if (rand < 0.33) {
        hr = Math.random() > 0.5 ? 135 : 45; // high heart rate / low heart rate
      } else if (rand < 0.66) {
        o2 = Math.floor(Math.random() * (91 - 85) + 85); // low oxygen
      } else {
        sys = 155; // high blood pressure
        dia = 95;
      }
    }

    try {
      const response = await fetch(`${API_URL}/sensor-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          patient_id: selectedPatientId,
          heart_rate: hr,
          spo2: o2,
          systolic_bp: sys,
          diastolic_bp: dia,
          ecg_value: ecg
        }),
      });

      if (!response.ok) {
        console.error('Failed to post simulated sensor data');
      }
    } catch (err) {
      console.error('Network error during simulation:', err);
    } finally {
      setTimeout(() => setIsSimulating(false), 300);
    }
  };

  if (patients.length === 0) {
    return (
      <div className="dashboard-empty-state">
        <div className="dashboard-empty-icon">
          <User size={64} style={{ opacity: 0.5 }} />
        </div>
        <h2 className="page-title" style={{ marginBottom: '1rem' }}>Chưa Có Bệnh Nhân Nào</h2>
        <p className="page-subtitle" style={{ marginBottom: '2rem' }}>
          Hệ thống chỉ hiển thị tài khoản Patient đã đăng ký và xác thực OTP qua email.
        </p>
        <button className="btn btn-primary" onClick={onAddPatientClick}>
          <Plus size={18} /> Mở danh sách bệnh nhân
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header and Controls */}
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Hệ Thống Giám Sát</h1>
          <p className="page-subtitle">Xem chỉ số sinh tồn và tín hiệu điện tâm đồ thời gian thực</p>
        </div>

        <div className="dashboard-header-actions">
          <div className="patient-selector-wrapper">
            <span className="patient-selector-label">Bệnh nhân:</span>
            <select
              className="form-control patient-selector"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Connection and Telemetry Status Badges */}
          {!isConnected ? (
            <span className="connection-badge offline">
              ● MẤT KẾT NỐI (Offline)
            </span>
          ) : isStale && currentMetrics.heartRate !== null ? (
            <span className="connection-badge stale">
              ● DỮ LIỆU CŨ (Stale)
            </span>
          ) : currentMetrics.heartRate !== null ? (
            <span className="connection-badge live">
              ● LIVE FEED (Realtime)
            </span>
          ) : (
            <span className="connection-badge waiting">
              ĐANG ĐỢI TÍN HIỆU
            </span>
          )}
        </div>
      </div>

      {/* Realtime Status Strip (Mục 2) */}
      <div className="realtime-status-strip">
        <div className="realtime-status-indicator-wrapper">
          <span className={`realtime-status-indicator ${isRealtimeActive ? 'live' : 'waiting'}`}>
            {isRealtimeActive ? 'ĐANG NHẬN REALTIME (Live Feed)' : 'ĐANG CHỜ TÍN HIỆU CẢM BIẾN'}
          </span>
        </div>
        <div className="realtime-status-meta">
          Bệnh nhân: <strong className="realtime-status-highlight">{activePatient?.full_name}</strong> • 
          Trạng thái nguồn: <strong className="realtime-status-highlight">{metricsSourceLabel}</strong>
        </div>
      </div>

      {/* Telemetry Staleness warning overlay banner */}
      {isConnected && isStale && currentMetrics.heartRate !== null && (
        <div className="stale-vitals-banner" style={{ marginBottom: '1.5rem' }}>
          <Clock size={16} />
          <span>Cảnh báo: Dữ liệu giám sát sinh hiệu có thể đã cũ (lần cập nhật cuối cách đây hơn 30 giây).</span>
        </div>
      )}

      {/* Real-time Metric Cards Grid */}
      <div className="grid-3 vitals-grid">
        {/* Heart Rate Card */}
        {(() => {
          const hasData = currentMetrics.heartRate !== null;
          const isHigh = hasData && currentMetrics.heartRate! > 120;
          const isLow = hasData && currentMetrics.heartRate! < 50;
          const isCritical = isHigh || isLow;
          
          const hrStatus = !hasData ? 'normal' : isCritical ? 'critical' : 'normal';
          const statusText = !hasData 
            ? 'Chờ tín hiệu' 
            : isHigh 
              ? 'Nhịp tim cao' 
              : isLow 
                ? 'Nhịp tim thấp' 
                : 'Bình thường';
          
          return (
            <div className={`panel metric-card heartrate ${isCritical ? 'critical-pulse' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">Nhịp Tim</span>
                <div className="metric-header-right">
                  <span className={`metric-status-badge ${hrStatus}`}>{statusText}</span>
                  <div className="metric-icon-box">
                    <Heart className={hasData ? 'beat-animated' : ''} size={20} />
                  </div>
                </div>
              </div>
              <div className="metric-body">
                {hasData ? (
                  <>
                    <span className="metric-value tabular-nums">{currentMetrics.heartRate}</span>
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
                <Radio size={12} className={hasData ? 'beat-animated' : ''} style={{ color: 'var(--color-primary)' }} />
                <span className="metric-range">Khoảng an toàn: 50 - 120 BPM</span>
                {currentMetrics.updatedAt && <span className="metric-source">• {currentMetrics.updatedAt}</span>}
              </div>
            </div>
          );
        })()}

        {/* SpO2 Card */}
        {(() => {
          const hasData = currentMetrics.spo2 !== null;
          const isCritical = hasData && currentMetrics.spo2! < 92;
          const isWarning = hasData && currentMetrics.spo2! >= 92 && currentMetrics.spo2! < 95;
          
          const o2Status = !hasData ? 'normal' : isCritical ? 'critical' : isWarning ? 'warning' : 'normal';
          const statusText = !hasData 
            ? 'Chờ tín hiệu' 
            : isCritical 
              ? 'SpO2 thấp nguy kịch' 
              : isWarning 
                ? 'Cần theo dõi' 
                : 'Bình thường';
                
          return (
            <div className={`panel metric-card spo2 ${isCritical ? 'critical-pulse' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">Nồng độ Oxy SpO2</span>
                <div className="metric-header-right">
                  <span className={`metric-status-badge ${o2Status}`}>{statusText}</span>
                  <div className="metric-icon-box">
                    <Activity size={20} />
                  </div>
                </div>
              </div>
              <div className="metric-body">
                {hasData ? (
                  <>
                    <span className="metric-value tabular-nums">{currentMetrics.spo2}</span>
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
                <Radio size={12} style={{ color: 'var(--color-spo2)' }} />
                <span className="metric-range">Khoảng an toàn: &ge; 95%</span>
                {currentMetrics.updatedAt && <span className="metric-source">• {currentMetrics.updatedAt}</span>}
              </div>
            </div>
          );
        })()}

        {/* Blood Pressure Card */}
        {(() => {
          const hasData = currentMetrics.systolicBp !== null;
          const isHigh = hasData && (currentMetrics.systolicBp! >= 140 || currentMetrics.diastolicBp! >= 90);
          const isLow = hasData && (currentMetrics.systolicBp! < 90 || currentMetrics.diastolicBp! < 60);
          const isCritical = isHigh || isLow;
          
          const bpStatus = !hasData ? 'normal' : isCritical ? 'critical' : 'normal';
          const statusText = !hasData 
            ? 'Chờ tín hiệu' 
            : isHigh 
              ? 'Huyết áp cao' 
              : isLow 
                ? 'Huyết áp thấp' 
                : 'Bình thường';
                
          return (
            <div className={`panel metric-card bp ${isCritical ? 'critical-pulse' : ''}`}>
              <div className="metric-header">
                <span className="metric-title">Huyết Áp</span>
                <div className="metric-header-right">
                  <span className={`metric-status-badge ${bpStatus}`}>{statusText}</span>
                  <div className="metric-icon-box">
                    <Activity size={20} />
                  </div>
                </div>
              </div>
              <div className="metric-body">
                {hasData ? (
                  <>
                    <span className="metric-value bp-value tabular-nums">{currentMetrics.systolicBp}/{currentMetrics.diastolicBp}</span>
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
                <Radio size={12} style={{ color: 'var(--color-bp)' }} />
                <span className="metric-range">Khoảng an toàn: 90/60 - 140/90</span>
                {currentMetrics.updatedAt && <span className="metric-source">• {currentMetrics.updatedAt}</span>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ECG Graphic and Patient Info Layout */}
      <div className="grid-2-3">
        {/* ECG Waveform panel with clinical context (Mục 6) */}
        <div className="panel">
          <div className="ecg-panel-header">
            <h3 className="ecg-panel-title">
              <Activity className={isRealtimeActive ? 'beat-animated' : ''} size={18} style={{ color: 'var(--color-spo2)' }} />
              Điện Tâm Đồ Realtime (ECG)
            </h3>
            <div className="ecg-panel-meta">
              <span className="ecg-status-badge">
                {isRealtimeActive ? 'Đang nhận tín hiệu' : 'Waveform đang chờ dữ liệu realtime'}
              </span>
              {currentMetrics.heartRate !== null && (
                <span className="tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)' }}>
                  {currentMetrics.heartRate} BPM
                </span>
              )}
            </div>
          </div>
          <div className="ecg-canvas-wrapper">
            <ECGChart 
              liveEcgValue={currentMetrics.ecgValue !== null ? currentMetrics.ecgValue : undefined} 
              heartRate={currentMetrics.heartRate !== null ? currentMetrics.heartRate : 75} 
            />
          </div>
        </div>

        {/* Right column stacking 3D Heart and Patient Details */}
        <div className="dashboard-side-column">
          {/* Beating Heart 3D holographic panel */}
          <div className="panel heart-panel-center">
            <BeatingHeart3D heartRate={currentMetrics.heartRate !== null ? currentMetrics.heartRate : 0} />
          </div>

          {/* Patient Details Panel (Mục 10) */}
          <div className="panel patient-summary-panel">
            <h3 className="metric-title patient-summary-title">
              Thông Tin Bệnh Nhân
            </h3>
            
            {activePatient && (
              <>
                <div>
                  <div className="patient-info-name">
                    {activePatient.full_name}
                  </div>
                  <div className="patient-info-meta">
                    {activePatient.gender === 'Nam' ? 'Nam' : 'Nữ'} • {activePatient.age} tuổi
                  </div>
                </div>

                <div className="patient-summary-row">
                  <span className="patient-info-label">Điện thoại</span>
                  <span>{activePatient.phone || 'Chưa cung cấp'}</span>
                </div>

                <div className="patient-summary-row">
                  <span className="patient-info-label">Địa chỉ</span>
                  <span className="patient-info-address">
                    {activePatient.address || 'Chưa cung cấp'}
                  </span>
                </div>

                <div className="patient-summary-row">
                  <span className="patient-info-label">Lịch sử bệnh án</span>
                  <span className="patient-info-medical">
                    {activePatient.medical_history || 'Không ghi nhận tiền sử bệnh'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Warnings & Alerts Grid (Mục 5) */}
      <div className="panel">
        <h3 className="metric-title alert-section-title">
          <AlertTriangle size={16} className="alert-section-icon" /> Cảnh Báo Gần Đây của bệnh nhân
        </h3>
        
        {activePatientAlerts.length === 0 ? (
          <div className="alert-empty-state">
            Không có cảnh báo bất thường nào được ghi nhận cho bệnh nhân đang chọn.
          </div>
        ) : (
          <div className="alert-list-scroll">
            {activePatientAlerts.slice(0, 5).map((alert, index) => {
              const severityMeta = getSeverityMeta(alert.severity);
              const AlertIcon = severityMeta.icon;
              const severityClass = getAlertSeverityClass(alert.severity);
              const severityLabel = getAlertSeverityLabel(alert.severity);
              
              return (
                <div key={alert.id || index} className={`alert-strip ${severityClass}`}>
                  <AlertIcon className="alert-strip-icon" size={16} />
                  <div className="alert-strip-body">
                    <div className="alert-strip-title">
                      {alert.alert_type} <span className="alert-severity-badge">{severityLabel}</span>
                    </div>
                    <div className="alert-strip-desc">{alert.message}</div>
                    <div className="alert-strip-time tabular-nums">
                      {alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : 'Vừa xong'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TESTING SIMULATION PLATFORM DRAWER (Mục 7) */}
      {import.meta.env.DEV && (
        <div className="simulation-controls-panel">
          <h4 className="simulation-label">
            <Radio size={14} className="beat-animated" style={{ color: 'var(--color-primary)' }} /> CÔNG CỤ KIỂM THỬ (DEVELOPER TESTING TOOLS)
          </h4>
          <p className="sim-description">
            Sử dụng bảng mô phỏng thiết bị đeo dưới đây để gửi tín hiệu nhịp sinh học lên Backend, hỗ trợ kiểm tra đường ống truyền nhận WebSocket realtime.
          </p>
          <div className="sim-buttons-row">
            <button 
              className="btn btn-secondary" 
              onClick={() => handleSimulateTelemetry(false)}
              disabled={isSimulating}
              title="Gửi dữ liệu bình thường đến Backend để kiểm tra"
            >
              <Play size={16} /> Giả lập Bình thường
            </button>
            
            <button 
              className="btn btn-primary btn-abnormal" 
              onClick={() => handleSimulateTelemetry(true)}
              disabled={isSimulating}
              title="Gửi dữ liệu bất thường đến Backend để kiểm tra cảnh báo"
            >
              <AlertTriangle size={16} /> Giả lập Bất thường
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
