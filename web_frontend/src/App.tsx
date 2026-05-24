import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Bell, LogOut, Activity, AlertOctagon, Video, TrendingUp, Sun, Moon } from 'lucide-react';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Dashboard } from './components/Dashboard';
import { Patients } from './components/Patients';
import { Alerts } from './components/Alerts';
import { ICUCamera } from './components/ICUCamera';
import { StatsDashboard } from './components/StatsDashboard';
import { PatientDetail } from './components/PatientDetail';
import { useWebSocket } from './hooks/useWebSocket';
import { API_URL, WS_URL } from './config';

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

export const App: React.FC = () => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme === 'light' || savedTheme === 'dark') ? savedTheme : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');

  // Navigation route state
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'patients' | 'alerts' | 'icu-camera' | 'stats' | 'patient-detail'>('dashboard');
  const [selectedPatientIdForDetail, setSelectedPatientIdForDetail] = useState<string | null>(null);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);

  // App core database states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<SensorData | null>(null);

  // Real-time notification banners
  const [activeBanner, setActiveBanner] = useState<{ message: string; patientName: string; severity: string } | null>(null);

  // Fetch initial patient records
  const fetchPatients = async () => {
    try {
      const response = await fetch(`${API_URL}/patients`);
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      }
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  };

  // Fetch initial alert log logs
  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_URL}/alerts`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPatients();
      fetchAlerts();
    }
  }, [token]);

  // Handle incoming web socket telemetry broadcasts
  const handleWebSocketMessage = (data: SensorData) => {
    // Save telemetry to update dashboard canvas/metrics
    setLatestTelemetry(data);

    // If an alert is broadcasted, handle instant notification and prepend alert
    if (data.is_abnormal && data.alerts.length > 0) {
      const firstAlert = data.alerts[0];
      const matchingPatient = patients.find(p => p.id === data.patient_id);
      const patientName = matchingPatient ? matchingPatient.full_name : 'Bệnh nhân';

      // Set global warning banner
      setActiveBanner({
        message: firstAlert.message,
        patientName,
        severity: firstAlert.severity
      });

      // Automatically clear warning banner after 7 seconds
      setTimeout(() => {
        setActiveBanner(null);
      }, 7000);

      // Prepend to local alerts log list so the alerts page updates in real-time
      const newAlerts: Alert[] = data.alerts.map(a => ({
        patient_id: data.patient_id,
        full_name: patientName,
        alert_type: a.alert_type,
        message: a.message,
        severity: a.severity,
        created_at: new Date().toISOString()
      }));

      setAlerts(prev => [...newAlerts, ...prev]);
    }
  };

  // Connect to backend websocket
  useWebSocket(`${WS_URL}/ws/realtime`, token ? handleWebSocketMessage : undefined);

  // Authentication callbacks
  const handleLoginSuccess = (userToken: string, userData: any) => {
    localStorage.setItem('token', userToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(userToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setCurrentScreen('dashboard');
  };

  if (!token) {
    return authScreen === 'login' ? (
      <Login 
        onLoginSuccess={handleLoginSuccess} 
        onNavigateToRegister={() => setAuthScreen('register')} 
      />
    ) : (
      <Register 
        onRegisterSuccess={() => setAuthScreen('login')} 
        onNavigateToLogin={() => setAuthScreen('login')} 
      />
    );
  }

  return (
    <div className="app-vertical-layout">
      {/* Real-time Global Alert notification banner */}
      {activeBanner && (
        <div className="global-notification-bar">
          <AlertOctagon className="beat-animated" size={18} />
          <span>
            <strong>CẢNH BÁO NGUY KỊCH ({activeBanner.severity.toUpperCase()}):</strong> Bệnh nhân{' '}
            {activeBanner.patientName} - {activeBanner.message}!
          </span>
          <button 
            onClick={() => setActiveBanner(null)}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '4px', color: 'white', padding: '2px 8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}
          >
            Đóng
          </button>
        </div>
      )}

      {/* Top Header menu navigation bar */}
      <header className="top-header">
        <div className="brand" style={{ margin: 0 }}>
          <div className="brand-icon">
            <Activity className="beat-animated" size={24} />
          </div>
          <span className="brand-name">HEART MONITOR</span>
        </div>

        <nav className="top-header-menu">
          <div 
            className={`nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('dashboard')}
          >
            <LayoutDashboard size={16} />
            <span>Hệ Thống Giám Sát</span>
          </div>

          <div 
            className={`nav-item ${currentScreen === 'patients' || currentScreen === 'patient-detail' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('patients')}
          >
            <Users size={16} />
            <span>Hồ Sơ Bệnh Nhân</span>
          </div>

          <div 
            className={`nav-item ${currentScreen === 'alerts' ? 'active' : ''}`}
            onClick={() => {
              setCurrentScreen('alerts');
              fetchAlerts(); // Refresh alerts
            }}
          >
            <Bell size={16} />
            <span>Cảnh Báo Hệ Thống</span>
            {alerts.filter(a => a.severity === 'high').length > 0 && (
              <span className="badge high" style={{ marginLeft: '8px', padding: '2px 6px', fontSize: '0.65rem' }}>
                {alerts.filter(a => a.severity === 'high').length}
              </span>
            )}
          </div>

          <div 
            className={`nav-item ${currentScreen === 'icu-camera' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('icu-camera')}
          >
            <Video size={16} />
            <span>Phòng ICU</span>
          </div>

          <div 
            className={`nav-item ${currentScreen === 'stats' ? 'active' : ''}`}
            onClick={() => setCurrentScreen('stats')}
          >
            <TrendingUp size={16} />
            <span>Thống Kê</span>
          </div>
        </nav>

        <div className="top-header-right">
          {/* Theme Toggle Button */}
          <button 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="theme-toggle-btn"
            title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: theme === 'dark' ? '#ffb606' : '#475467',
              transition: 'var(--transition-smooth)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--glass-border-hover)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--glass-border)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {theme === 'dark' ? (
              <Sun size={18} fill="#ffb606" color="#ffb606" />
            ) : (
              <Moon size={18} fill="#475467" color="#475467" />
            )}
          </button>

          {user && (
            <div className="user-profile" style={{ margin: 0, padding: '6px 12px' }}>
              <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.8rem' }}>
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name" style={{ fontSize: '0.8rem' }}>{user.full_name}</div>
                <div className="user-role" style={{ fontSize: '0.65rem' }}>{user.role || 'Nhân viên y tế'}</div>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="Đăng xuất" style={{ marginLeft: '8px' }}>
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Tab navigation bar */}
      <nav className="mobile-nav-bar">
        <div 
          className={`mobile-nav-item ${currentScreen === 'dashboard' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('dashboard')}
        >
          <LayoutDashboard />
          <span>Giám sát</span>
        </div>

        <div 
          className={`mobile-nav-item ${currentScreen === 'patients' || currentScreen === 'patient-detail' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('patients')}
        >
          <Users />
          <span>Bệnh nhân</span>
        </div>

        <div 
          className={`mobile-nav-item ${currentScreen === 'alerts' ? 'active' : ''}`}
          onClick={() => {
            setCurrentScreen('alerts');
            fetchAlerts();
          }}
        >
          <Bell />
          <span>Cảnh báo</span>
        </div>

        <div 
          className={`mobile-nav-item ${currentScreen === 'icu-camera' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('icu-camera')}
        >
          <Video />
          <span>ICU</span>
        </div>

        <div 
          className={`mobile-nav-item ${currentScreen === 'stats' ? 'active' : ''}`}
          onClick={() => setCurrentScreen('stats')}
        >
          <TrendingUp />
          <span>Thống kê</span>
        </div>
      </nav>

      {/* Main Render Page Content */}
      <main className="main-content" style={{ marginTop: activeBanner ? '40px' : '0px' }}>
        {currentScreen === 'dashboard' && (
          <Dashboard 
            patients={patients} 
            latestTelemetry={latestTelemetry} 
            alerts={alerts}
            onAddPatientClick={() => {
              setCurrentScreen('patients');
              setShowAddPatientModal(true);
            }}
          />
        )}
        
        {currentScreen === 'patients' && (
          <Patients 
            patients={patients} 
            onPatientAdded={fetchPatients}
            showAddModal={showAddPatientModal}
            setShowAddModal={setShowAddPatientModal}
            onViewPatientDetail={(patientId) => {
              setSelectedPatientIdForDetail(patientId);
              setCurrentScreen('patient-detail');
            }}
          />
        )}
        
        {currentScreen === 'alerts' && (
          <Alerts alerts={alerts} />
        )}

        {currentScreen === 'icu-camera' && (
          <ICUCamera />
        )}

        {currentScreen === 'stats' && (
          <StatsDashboard patients={patients} alerts={alerts} />
        )}

        {currentScreen === 'patient-detail' && (() => {
          const p = patients.find(p => p.id === selectedPatientIdForDetail);
          return p ? (
            <PatientDetail
              patient={p}
              latestTelemetry={latestTelemetry}
              alerts={alerts}
              onBackClick={() => setCurrentScreen('patients')}
            />
          ) : (
            <div className="panel" style={{ textAlign: 'center', padding: '2rem' }}>
              Không tìm thấy thông tin bệnh nhân.
            </div>
          );
        })()}
      </main>
    </div>
  );
};
export default App;
