import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ForgotPassword } from './components/ForgotPassword';
import { ChangePassword } from './components/ChangePassword';
import { Dashboard } from './components/Dashboard';
import { Patients } from './components/Patients';
import { Alerts } from './components/Alerts';
import { PatientDetail } from './components/PatientDetail';
import { FeatureHub } from './components/FeatureHub';
import { ApiDataPage } from './components/ApiDataPage';
import { ProfilePage } from './components/ProfilePage';
import { CmsPage } from './components/cms/CmsPage';
import { EmailCmsPage } from './components/cms/EmailCmsPage';
import { PatientChatbot } from './pages/PatientChatbot';
import { DoctorChatbot } from './pages/DoctorChatbot';
import { DoctorsManager } from './components/DoctorsManager';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { defaultRouteByRole, normalizeRole, type UserRole } from './auth/roles';
import { AdminLayout, DoctorLayout, PatientLayout } from './layouts/RoleLayout';
import { AdminDashboard, DoctorDashboard, PatientHome, PlaceholderPage } from './pages/RolePages';
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
  alerts: Array<{ alert_type: string; message: string; severity: string }>;
}

const privateRouteRole = (path: string): UserRole | null => {
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/doctor')) return 'doctor';
  if (path.startsWith('/patient')) return 'patient';
  return null;
};

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/admin/email': { title: 'Email CMS', subtitle: 'Quản lý mẫu email, gửi thông báo và theo dõi lịch sử.' },
  '/admin/patients': { title: 'Quản lý bệnh nhân', subtitle: 'Hồ sơ y tế, lịch sử khám và thông tin người bệnh.' },
  '/patient/chatbot': { title: 'Trợ lý AI', subtitle: 'Giải đáp, phân tích và theo dõi sức khỏe tim mạch.' },
  '/doctor/ai-assistant': { title: 'AI Command Center', subtitle: 'Trợ lý phân tích dữ liệu, tóm tắt bệnh án và phát hiện bất thường.' },
  '/doctor/chatbot': { title: 'Chatbot AI', subtitle: 'Giải đáp, phân tích và hỗ trợ tư vấn sức khỏe tim mạch.' },
  '/admin/doctors': { title: 'Quản lý bác sĩ', subtitle: 'Danh sách bác sĩ, phân công chuyên khoa và quyền truy cập.' },
  '/admin/system-logs': { title: 'Nhật ký hệ thống', subtitle: 'Audit log, lịch sử đăng nhập và thao tác bảo mật.' },
  '/admin/settings': { title: 'Cài đặt hệ thống', subtitle: 'Cấu hình nền tảng, API token và trạng thái kết nối.' },
  '/admin/profile': { title: 'Hồ sơ cá nhân', subtitle: 'Thông tin tài khoản admin và đổi mật khẩu.' },
  '/doctor/prescriptions': { title: 'Đơn thuốc', subtitle: 'Kê đơn, xem lịch sử đơn thuốc và AI hỗ trợ tham khảo.' },
  '/doctor/chat': { title: 'Chat tư vấn', subtitle: 'Tư vấn trực tuyến bảo mật giữa bác sĩ và bệnh nhân.' },
  '/doctor/messages': { title: 'Nhắn tin tư vấn', subtitle: 'Tư vấn trực tuyến bảo mật giữa bác sĩ và bệnh nhân.' },
  '/doctor/ai-analysis': { title: 'AI phân tích sức khỏe', subtitle: 'Dự đoán nguy cơ tim mạch, phát hiện bất thường và gợi ý chẩn đoán tham khảo.' },
  '/doctor/profile': { title: 'Hồ sơ cá nhân', subtitle: 'Thông tin bác sĩ, chuyên khoa và lịch làm việc.' },
  '/patient/home': { title: 'Trang chủ bệnh nhân', subtitle: 'Tổng quan chỉ số sức khỏe của bạn.' },
  '/patient/dashboard': { title: 'Trang chủ bệnh nhân', subtitle: 'Tổng quan chỉ số sức khỏe của bạn.' },
  '/patient/health': { title: 'Chỉ số sức khỏe', subtitle: 'Theo dõi nhịp tim, SpO2, huyết áp và ECG realtime.' },
  '/patient/metrics': { title: 'Chỉ số sức khỏe', subtitle: 'Theo dõi nhịp tim, SpO2, huyết áp và ECG realtime.' },
  '/patient/history': { title: 'Lịch sử sức khỏe', subtitle: 'Lưu trữ và phân tích chỉ số sức khỏe theo thời gian.' },
  '/patient/prescriptions': { title: 'Đơn thuốc của tôi', subtitle: 'Danh sách đơn thuốc hiện tại và lịch sử kê đơn.' },
  '/patient/sos': { title: 'SOS khẩn cấp', subtitle: 'Kích hoạt cảnh báo khẩn cấp gửi tới bác sĩ và hệ thống.' },
  '/patient/chat': { title: 'Chat với bác sĩ', subtitle: 'Trao đổi nhanh với bác sĩ phụ trách.' },
  '/patient/notifications': { title: 'Thông báo', subtitle: 'Lịch hẹn, cảnh báo sức khỏe và cập nhật hệ thống.' },
  '/patient/profile': { title: 'Hồ sơ cá nhân', subtitle: 'Xem/cập nhật thông tin cá nhân và ảnh đại diện.' },
  '/patient/settings': { title: 'Cài đặt', subtitle: 'Tùy chỉnh thông báo, bảo mật và giao diện.' },
};

const useBrowserPath = () => {
  const [path, setPath] = useState(() => window.location.pathname || '/');

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string, replace = false) => {
    if (window.location.pathname === to) {
      setPath(to);
      return;
    }

    if (replace) {
      window.history.replaceState(null, '', to);
    } else {
      window.history.pushState(null, '', to);
    }
    setPath(to);
  };

  return { path, navigate };
};

const AppContent: React.FC = () => {
  const { accessToken, isAuthenticated, loading, role, login, refreshUser } = useAuth();
  const { path, navigate } = useBrowserPath();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<SensorData | null>(null);
  const [activeBanner, setActiveBanner] = useState<{
    message: string;
    patientName: string;
    patientId: string;
    severity: string;
    timestamp: string;
  } | null>(null);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const normalizedPath = path === '/' ? (role ? defaultRouteByRole[role] : '/login') : path;
  const routeRole = privateRouteRole(normalizedPath);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (path === '/' && !loading) {
      navigate(role ? defaultRouteByRole[role] : '/login', true);
    }
  }, [loading, path, role]);

  useEffect(() => {
    if (!loading && isAuthenticated && role && ['/login', '/register', '/forgot-password'].includes(path)) {
      navigate(defaultRouteByRole[role], true);
    }
  }, [isAuthenticated, loading, path, role]);

  const fetchPatients = async () => {
    try {
      const response = await fetch(`${API_URL}/patients`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (response.ok) setPatients(await response.json());
    } catch (err) {
      console.error('Failed to fetch patients:', err);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(`${API_URL}/alerts`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (response.ok) setAlerts(await response.json());
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/doctors`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (response.ok) setDoctors(await response.json());
    } catch (err) {
      console.error('Failed to fetch doctors:', err);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    fetchPatients();
    fetchAlerts();
    if (role === 'admin') {
      fetchDoctors();
    }
  }, [accessToken, role]);

  const handleSensorTelemetry = useCallback((data: SensorData) => {
    setLatestTelemetry(data);
    if (!data.is_abnormal || data.alerts.length === 0) return;

    const firstAlert = data.alerts[0];
    const matchingPatient = patients.find((patient) => patient.id === data.patient_id);
    const patientName = matchingPatient?.full_name || 'Bệnh nhân';

    const severity = firstAlert.severity || 'high';
    const timestamp = new Date().toLocaleTimeString('vi-VN');

    setActiveBanner({
      message: firstAlert.message,
      patientName,
      patientId: data.patient_id,
      severity,
      timestamp
    });

    // Persistent for critical or high alarms (no auto-timeout)
    const isPersistent = ['critical', 'high'].includes(severity.toLowerCase());
    if (!isPersistent) {
      window.setTimeout(() => {
        setActiveBanner((prev) => prev && prev.patientId === data.patient_id && prev.message === firstAlert.message ? null : prev);
      }, 7000);
    }

    setAlerts((prev) => [
      ...data.alerts.map((alert) => ({
        patient_id: data.patient_id,
        full_name: patientName,
        alert_type: alert.alert_type,
        message: alert.message,
        severity: alert.severity,
        created_at: new Date().toISOString(),
      })),
      ...prev,
    ]);
  }, [patients]);

  const handleRealtimeMessage = useCallback((message: any) => {
    if (!message?.type) {
      handleSensorTelemetry(message as SensorData);
      return;
    }

    if (message.type === 'health_metrics' && message.data) {
      handleSensorTelemetry({
        ...message.data,
        patient_id: message.patient_id || message.data.patient_id,
      } as SensorData);
      return;
    }

    if (message.type === 'emergency_alerts' && message.data) {
      const alert = {
        ...message.data,
        patient_id: message.patient_id || message.data.patient_id,
      } as Alert;
      const matchingPatient = patients.find((patient) => patient.id === alert.patient_id);
      const patientName = alert.full_name || matchingPatient?.full_name || 'Bệnh nhân';
      const severity = alert.severity || 'high';
      const timestamp = new Date().toLocaleTimeString('vi-VN');

      setActiveBanner({
        message: alert.message,
        patientName,
        patientId: alert.patient_id,
        severity,
        timestamp
      });

      // Persistent for critical or high alarms (no auto-timeout)
      const isPersistent = ['critical', 'high'].includes(severity.toLowerCase());
      if (!isPersistent) {
        window.setTimeout(() => {
          setActiveBanner((prev) => prev && prev.patientId === alert.patient_id && prev.message === alert.message ? null : prev);
        }, 7000);
      }
      setAlerts((prev) => [{ ...alert, full_name: patientName }, ...prev]);
    }
  }, [handleSensorTelemetry, patients]);

  const { isConnected } = useWebSocket(WS_URL, accessToken ? handleRealtimeMessage : undefined, accessToken);

  const handleLoginSuccess = (token: string, userData: { id: string; full_name: string; email: string; role: string; must_change_password?: boolean }) => {
    const userRole = normalizeRole(userData.role);
    if (!userRole) {
      throw new Error('Tài khoản chưa được phân quyền');
    }

    const normalizedUser = login(token, { ...userData, role: userRole });
    if (userData.must_change_password) {
      navigate('/change-password', true);
    } else {
      navigate(defaultRouteByRole[normalizedUser.role], true);
    }
  };

  const renderPatientList = () => {
    if (selectedPatientId) {
      const patient = patients.find((item) => item.id === selectedPatientId);
      return patient ? (
        <PatientDetail
          patient={patient}
          latestTelemetry={latestTelemetry}
          alerts={alerts}
          onBackClick={() => setSelectedPatientId(null)}
        />
      ) : (
        <PlaceholderPage title="Không tìm thấy bệnh nhân" subtitle="Hồ sơ này không tồn tại hoặc đã bị xóa." />
      );
    }

    return (
      <Patients
        patients={patients}
        onPatientAdded={fetchPatients}
        showAddModal={showAddPatientModal}
        setShowAddModal={setShowAddPatientModal}
        onViewPatientDetail={setSelectedPatientId}
      />
    );
  };

  const routeContent = useMemo(() => {
    switch (normalizedPath) {
      case '/patient/chatbot':
        return <PatientChatbot />;
      case '/admin/dashboard':
        return <AdminDashboard patients={patients} alerts={alerts} doctors={doctors} />;
      case '/admin/cms':
        return <CmsPage />;
      case '/admin/email':
        return <EmailCmsPage />;
      case '/admin/doctors':
        return <DoctorsManager />;
      case '/doctor/ai-assistant':
      case '/doctor/chatbot':
        return <DoctorChatbot />;
      case '/admin/patients':
      case '/doctor/patients':
        return renderPatientList();
      case '/admin/alerts':
      case '/doctor/alerts':
        return <Alerts alerts={alerts} />;
      case '/admin/devices':
        return <FeatureHub type="devices" role="admin" patients={patients} />;
      case '/admin/cameras':
        return <ApiDataPage title="Quản lý camera" subtitle="Danh sách camera thật từ bảng cameras theo quyền hiện tại." endpoint="/cameras" />;
      case '/admin/reports':
      case '/doctor/reports':
        return <ApiDataPage title="Báo cáo" subtitle="Danh sách báo cáo thật từ bảng reports theo quyền hiện tại." endpoint="/reports" />;
      case '/doctor/dashboard':
        return <DoctorDashboard patients={patients} alerts={alerts} />;
      case '/doctor/appointments':
      case '/patient/appointments':
        return <FeatureHub type="appointments" role={routeRole || 'doctor'} patients={patients} />;
      case '/doctor/medical-records':
        return <FeatureHub type="records" role="doctor" patients={patients} />;
      case '/doctor/prescriptions':
      case '/patient/prescriptions':
        return <ApiDataPage title={pageTitles[normalizedPath].title} subtitle={pageTitles[normalizedPath].subtitle} endpoint="/prescriptions" />;
      case '/doctor/chat':
      case '/doctor/messages':
      case '/patient/chat':
        return <ApiDataPage title={pageTitles[normalizedPath].title} subtitle={pageTitles[normalizedPath].subtitle} endpoint="/chat-messages" />;
      case '/patient/notifications':
        return <ApiDataPage title={pageTitles[normalizedPath].title} subtitle={pageTitles[normalizedPath].subtitle} endpoint="/notifications" />;
      case '/admin/system-logs':
        return <ApiDataPage title={pageTitles[normalizedPath].title} subtitle={pageTitles[normalizedPath].subtitle} endpoint="/audit-logs" />;
      case '/admin/profile':
      case '/doctor/profile':
      case '/patient/profile':
        return <ProfilePage role={routeRole || 'patient'} />;
      case '/doctor/realtime-monitoring':
        return <Dashboard patients={patients} latestTelemetry={latestTelemetry} alerts={alerts} onAddPatientClick={() => navigate('/doctor/patients')} isConnected={isConnected} />;
      case '/patient/home':
      case '/patient/dashboard':
        return <PatientHome latestTelemetry={latestTelemetry} alerts={alerts} isConnected={isConnected} />;
      default: {
        const meta = pageTitles[normalizedPath];
        return meta ? <PlaceholderPage title={meta.title} subtitle={meta.subtitle} /> : null;
      }
    }
  }, [alerts, latestTelemetry, normalizedPath, patients, routeRole, selectedPatientId, showAddPatientModal]);

  if (loading) {
    return <div className="route-loading">Đang khôi phục phiên đăng nhập...</div>;
  }

  if (path === '/register') {
    return <Register onRegisterSuccess={() => navigate('/login', true)} onNavigateToLogin={() => navigate('/login')} />;
  }

  if (path === '/forgot-password') {
    return <ForgotPassword onNavigateToLogin={() => navigate('/login')} />;
  }

  if (path === '/change-password') {
    if (!isAuthenticated || !role) {
      navigate('/login', true);
      return null;
    }
    return <ChangePassword onNavigateNext={() => {
      // Once successfully changed, refresh user info and navigate to default route
      refreshUser().then(() => {
        navigate(defaultRouteByRole[role], true);
      }).catch(() => {
        navigate(defaultRouteByRole[role], true);
      });
    }} />;
  }

  if (path === '/login' || (!routeRole && path !== '/change-password')) {
    if (!isAuthenticated) {
      return <Login 
        onLoginSuccess={handleLoginSuccess} 
        onNavigateToRegister={() => navigate('/register')} 
        onNavigateToForgotPassword={() => navigate('/forgot-password')}
      />;
    }
    navigate(role ? defaultRouteByRole[role] : '/login', true);
    return null;
  }

  if (!routeContent) {
    navigate(role ? defaultRouteByRole[role] : '/login', true);
    return null;
  }

  const layoutProps = {
    currentPath: normalizedPath,
    navigate,
    theme,
    onToggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    isConnected,
  };

  const layout = routeRole === 'admin'
    ? <AdminLayout {...layoutProps}>{routeContent}</AdminLayout>
    : routeRole === 'doctor'
      ? <DoctorLayout {...layoutProps}>{routeContent}</DoctorLayout>
      : <PatientLayout {...layoutProps}>{routeContent}</PatientLayout>;

  const handleViewPatientDetail = (patientId: string) => {
    setSelectedPatientId(patientId);
    if (role === 'doctor') {
      navigate('/doctor/patients');
    } else if (role === 'admin') {
      navigate('/admin/patients');
    }
    setActiveBanner(null);
  };

  return (
    <ProtectedRoute allowedRoles={routeRole ? [routeRole] : []} currentPath={normalizedPath} navigate={navigate}>
      {activeBanner && (
        <div className={`global-notification-bar ${activeBanner.severity.toLowerCase()}`} role="alert" aria-live="assertive">
          <div className="banner-header">
            <div className="banner-title-box">
              <AlertOctagon className="beat-animated" size={18} style={{ color: 'var(--color-critical)' }} />
              <span>CẢNH BÁO LÂM SÀNG</span>
            </div>
            <button className="banner-close-btn" type="button" onClick={() => setActiveBanner(null)} aria-label="Đóng cảnh báo">
              Đóng
            </button>
          </div>
          <div className="banner-body">
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>
              {activeBanner.patientName}
            </p>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              {activeBanner.message}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Độ nghiêm trọng: <span className={`metric-status-badge ${activeBanner.severity.toLowerCase()}`} style={{ display: 'inline-block', padding: '2px 6px', fontSize: '0.7rem' }}>
                {activeBanner.severity.toUpperCase()}
              </span> • {activeBanner.timestamp}
            </p>
          </div>
          {(role === 'doctor' || role === 'admin') && (
            <div className="banner-footer">
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px' }}
                onClick={() => handleViewPatientDetail(activeBanner.patientId)}
              >
                Xem chi tiết
              </button>
            </div>
          )}
        </div>
      )}
      {layout}
    </ProtectedRoute>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
