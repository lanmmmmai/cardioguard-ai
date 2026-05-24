import React, { useState, useEffect } from 'react';
import { Heart, Activity, AlertTriangle, User, Play, Radio, Plus } from 'lucide-react';
import { ECGChart } from './ECGChart';
import { BeatingHeart3D } from './BeatingHeart3D';
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
  alerts: Array<{
    alert_type: string;
    message: string;
    severity: string;
  }>;
}

interface DashboardProps {
  patients: Patient[];
  latestTelemetry: SensorData | null;
  alerts: Alert[];
  onAddPatientClick: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  patients, 
  latestTelemetry, 
  alerts,
  onAddPatientClick
}) => {
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Custom states for local overrides (so dashboard has initial values or simulated states)
  const [currentMetrics, setCurrentMetrics] = useState({
    heartRate: 75,
    spo2: 98,
    systolicBp: 120,
    diastolicBp: 80,
    ecgValue: 0.0,
    isAbnormal: false,
    alerts: [] as any[]
  });

  // Select the first patient automatically if none selected
  useEffect(() => {
    if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id);
    }
  }, [patients, selectedPatientId]);

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
        alerts: latestTelemetry.alerts
      });
    }
  }, [latestTelemetry, selectedPatientId]);

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
    let ecg = (Math.random() - 0.5) * 0.3; // tiny baseline

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
      <div style={{ textAlign: 'center', padding: '4rem 1.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          <User size={64} style={{ opacity: 0.5 }} />
        </div>
        <h2 className="page-title" style={{ marginBottom: '1rem' }}>Chưa Có Bệnh Nhân Nào</h2>
        <p className="page-subtitle" style={{ marginBottom: '2rem' }}>
          Đăng ký hồ sơ bệnh án bệnh nhân trước để bắt đầu theo dõi dữ liệu điện tâm đồ.
        </p>
        <button className="btn btn-primary" onClick={onAddPatientClick}>
          <Plus size={18} /> Đăng ký bệnh nhân mới
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header and Controls */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Hệ Thống Giám Sát</h1>
          <p className="page-subtitle">Xem chỉ số sinh tồn và tín hiệu điện tâm đồ thời gian thực</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Bệnh nhân:</span>
            <select
              className="form-control"
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              style={{ width: '220px', height: '42px', padding: '6px 12px' }}
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} ({p.age}t)</option>
              ))}
            </select>
          </div>

          <button 
            className="btn btn-secondary" 
            onClick={() => handleSimulateTelemetry(false)}
            disabled={isSimulating}
            title="Gửi dữ liệu bình thường đến Backend để kiểm tra"
          >
            <Play size={16} /> Giả lập Bình thường
          </button>
          
          <button 
            className="btn btn-primary" 
            onClick={() => handleSimulateTelemetry(true)}
            disabled={isSimulating}
            style={{ background: 'linear-gradient(135deg, var(--color-critical), #c2003c)', boxShadow: '0 4px 15px rgba(255, 0, 85, 0.25)' }}
            title="Gửi dữ liệu bất thường đến Backend để kiểm tra cảnh báo"
          >
            <AlertTriangle size={16} /> Giả lập Bất thường
          </button>
        </div>
      </div>

      {/* Real-time Metric Cards Grid */}
      <div className="grid-3">
        <div className={`panel metric-card heartrate ${currentMetrics.heartRate > 120 || currentMetrics.heartRate < 50 ? 'critical-pulse' : ''}`}>
          <div className="metric-header">
            <span className="metric-title">Nhịp Tim</span>
            <div className="metric-icon-box">
              <Heart className="beat-animated" size={20} />
            </div>
          </div>
          <div className="metric-body">
            <span className="metric-value">{currentMetrics.heartRate}</span>
            <span className="metric-unit">BPM</span>
          </div>
          <div className="metric-footer">
            <Radio size={12} className="beat-animated" style={{ color: 'var(--color-primary)' }} />
            <span>Giới hạn bình thường: 50 - 120 BPM</span>
          </div>
        </div>

        <div className={`panel metric-card spo2 ${currentMetrics.spo2 < 92 ? 'critical-pulse' : ''}`}>
          <div className="metric-header">
            <span className="metric-title">Nồng độ Oxy SpO2</span>
            <div className="metric-icon-box">
              <Activity size={20} />
            </div>
          </div>
          <div className="metric-body">
            <span className="metric-value">{currentMetrics.spo2}</span>
            <span className="metric-unit">%</span>
          </div>
          <div className="metric-footer">
            <Radio size={12} style={{ color: 'var(--color-spo2)' }} />
            <span>Giới hạn bình thường: &ge; 92%</span>
          </div>
        </div>

        <div className={`panel metric-card bp ${currentMetrics.systolicBp > 140 || currentMetrics.diastolicBp > 90 ? 'critical-pulse' : ''}`}>
          <div className="metric-header">
            <span className="metric-title">Huyết Áp</span>
            <div className="metric-icon-box">
              <Activity size={20} />
            </div>
          </div>
          <div className="metric-body">
            <span className="metric-value">{currentMetrics.systolicBp}/{currentMetrics.diastolicBp}</span>
            <span className="metric-unit">mmHg</span>
          </div>
          <div className="metric-footer">
            <Radio size={12} style={{ color: 'var(--color-bp)' }} />
            <span>Huyết áp bình thường: &lt; 140/90</span>
          </div>
        </div>
      </div>

      {/* ECG Graphic and Patient Info Layout */}
      <div className="grid-2-3">
        {/* ECG Waveform panel */}
        <div className="panel">
          <ECGChart liveEcgValue={currentMetrics.ecgValue} heartRate={currentMetrics.heartRate} />
        </div>

        {/* Right column stacking 3D Heart and Patient Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Beating Heart 3D holographic panel */}
          <div className="panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'center' }}>
            <BeatingHeart3D heartRate={currentMetrics.heartRate} />
          </div>

          {/* Patient Details Panel */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 className="metric-title" style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
              Thông Tin Bệnh Nhân
            </h3>
            
            {activePatient && (
              <>
                <div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
                    {activePatient.full_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {activePatient.gender === 'Nam' ? 'Nam' : 'Nữ'} • {activePatient.age} tuổi
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Điện thoại</span>
                  <span>{activePatient.phone || 'Chưa cung cấp'}</span>
                </div>

                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Địa chỉ</span>
                  <span style={{ display: 'block', maxHeight: '44px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activePatient.address || 'Chưa cung cấp'}
                  </span>
                </div>

                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Lịch sử bệnh án</span>
                  <span style={{ color: 'var(--color-warning)', fontWeight: 500 }}>
                    {activePatient.medical_history || 'Không ghi nhận tiền sử bệnh'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Warnings & Alerts Grid */}
      <div className="panel">
        <h3 className="metric-title" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-primary)' }} /> Cảnh Báo Gần Đây của bệnh nhân
        </h3>
        
        {activePatientAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Không có cảnh báo bất thường nào được ghi nhận cho bệnh nhân này.
          </div>
        ) : (
          <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '8px' }}>
            {activePatientAlerts.slice(0, 5).map((alert, index) => (
              <div key={index} className={`alert-strip ${alert.severity === 'high' ? 'high' : 'medium'}`}>
                <AlertTriangle className="alert-strip-icon" size={16} />
                <div className="alert-strip-body">
                  <div className="alert-strip-title" style={{ textTransform: 'uppercase' }}>
                    {alert.alert_type} ({alert.severity})
                  </div>
                  <div className="alert-strip-desc">{alert.message}</div>
                  <div className="alert-strip-time">
                    {alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : 'Vừa xong'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
