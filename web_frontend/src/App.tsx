/**
 * Mục đích: Thành phần ứng dụng gốc. Xử lý xác thực, định tuyến, thu thập
 *           dữ liệu telemetry WebSocket, banner cảnh báo thời gian thực và
 *           hiển thị bố cục theo từng vai trò.
 * Luồng xử lý: 1. AuthContext khôi phục phiên → 2. Phân giải tuyến đường dựa trên
 *              đường dẫn → 3. Tìm nạp dữ liệu (bệnh nhân, cảnh báo, bác sĩ) →
 *              4. Kết nối WebSocket cho telemetry trực tiếp → 5. Banner cảnh báo
 *              cho các chỉ số bất thường → 6. Bọc nội dung trong bố cục vai trò cụ thể
 *              (Admin|Doctor|Patient).
 * Quan hệ:
 *   - AuthContext, ProtectedRoute, bố cục vai trò (AdminLayout, DoctorLayout, PatientLayout)
 *   - Tất cả thành phần trang (Dashboard, Alerts, Appointments, Chatbots, v.v.)
 *   - Hook useWebSocket và kiểu SensorData/Alert cho pipeline thời gian thực
 *   - pageTitles và routeMeta cho siêu dữ liệu tuyến đường
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
import { Appointments } from './components/Appointments';
import { ApiDataPage } from './components/ApiDataPage';
import { ProfilePage } from './components/ProfilePage';
import { CmsPage } from './components/cms/CmsPage';
import { logger } from './utils/logger';
import { EmailCmsPage } from './components/cms/EmailCmsPage';
import { PatientChatbot } from './pages/PatientChatbot';
import { DoctorChatbot } from './pages/DoctorChatbot';
import { DoctorsManager } from './components/DoctorsManager';
import { UsersManager } from './components/UsersManager';
import { SystemSettings } from './components/SystemSettings';
import { PatientCompleteProfile } from './pages/PatientCompleteProfile';
import { DoctorCompleteProfile } from './pages/DoctorCompleteProfile';
import { DoctorPendingVerification, DoctorVerificationRejected } from './pages/DoctorStatusPages';
import { AdminDoctorVerification } from './components/AdminDoctorVerification';
import { AdminMedicalRecordsPage, DoctorMedicalRecordsPage, PatientMedicalRecordsPage } from './components/medical-records/MedicalRecordsPages';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { defaultRouteByRole, normalizeRole, UserRole } from './auth/roles';
import { AdminLayout, DoctorLayout, PatientLayout } from './layouts/RoleLayout';
import { AdminDashboard, DoctorDashboard, PatientHome, PlaceholderPage } from './pages/RolePages';
import { PatientHealthPage } from './pages/PatientHealthPage';
import { PatientSettingsPage } from './pages/PatientSettingsPage';
import { DoctorSettingsPage } from './pages/DoctorSettingsPage';
import { UserDataDeletionPage } from './pages/UserDataDeletionPage';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { useWebSocket } from './hooks/useWebSocket';
import { useBrowserPath } from './hooks/useBrowserPath';
import { privateRouteRole } from './navigation/routeMeta';
import { API_URL, WS_URL } from './config';
import { Patient, Alert, SensorData } from './types';
import { LocaleProvider, getPageMeta, useLocale } from './i18n/locale';

/**
 * Thành phần bên trong có thể tiêu thụ AuthContext một cách an toàn. Điều phối tất cả
 * trạng thái cấp ứng dụng, tìm nạp dữ liệu, nhắn tin thời gian thực và hiển thị tuyến đường.
 */
const AppContent: React.FC = () => {
  const { accessToken, isAuthenticated, loading, role, login, requiresPasswordChange, user } = useAuth();
  const { locale } = useLocale();
  const { path, navigate } = useBrowserPath();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
  });
  const [patients, setPatients] = useState<Patient[]>([]);
  const patientsRef = React.useRef(patients);
  React.useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Giữ tham chiếu đến timeout của banner hoạt động để có thể xóa khi hủy gắn hoặc thay thế
  const bannerTimeoutRef = useRef<number | null>(null);

  // Dọn dẹp timeout khi hủy gắn
  useEffect(() => {
    return () => {
      if (bannerTimeoutRef.current !== null) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, []);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [latestTelemetry, setLatestTelemetry] = useState<SensorData | null>(null);
  const [activeBanner, setActiveBanner] = useState<{
    message: string;
    patientName: string;
    patientId: string;
    severity: string;
    timestamp: string;
  } | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const getLastLoginRoute = (): string => {
    const lastRole = sessionStorage.getItem('last_role');
    if (lastRole === 'admin') return '/login-admin';
    if (lastRole === 'doctor') return '/login-doctor';
    return '/login';
  };

  const normalizedPath = path === '/' ? (role ? defaultRouteByRole[role] : getLastLoginRoute()) : path;
  const routeRole = privateRouteRole(normalizedPath);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const authPaths = [
      '/login', '/login-doctor', '/login-admin',
      '/register', '/register-doctor', '/register-admin',
      '/forgot-password', '/forgot-password-doctor', '/forgot-password-admin',
      '/reset-password', '/reset-password-doctor', '/reset-password-admin'
    ];

    if (path === '/' || !routeRole) {
      if (path === '/' || (!authPaths.includes(path) && path !== '/change-password')) {
        if (!getPageMeta(normalizedPath, locale)) {
          navigate(role ? defaultRouteByRole[role] : getLastLoginRoute(), true);
        }
      }
    }

    if (requiresPasswordChange && path !== '/change-password') {
      navigate('/change-password', true);
      return;
    }

    if (path === '/change-password') {
      if (!isAuthenticated || !role) {
        navigate(getLastLoginRoute(), true);
      }
    } else if (authPaths.includes(path)) {
      if (isAuthenticated && role) {
        navigate(defaultRouteByRole[role], true);
      }
    }
  }, [loading, path, role, isAuthenticated, routeRole, requiresPasswordChange, locale]);

  const fetchPatients = useCallback(async () => {
    const isVerifiedDoctor = role === 'doctor' && Boolean(user?.profile_completed && user?.is_verified);
    const doctorDataRoutes = new Set([
      '/doctor',
      '/doctor/dashboard',
      '/doctor/patients',
      '/doctor/medical-records',
      '/doctor/ai-assistant',
      '/doctor/chatbot',
      '/doctor/appointments',
      '/doctor/reports',
      '/doctor/realtime-monitoring',
      '/doctor/chat',
      '/doctor/messages',
    ]);
    const canFetchPatients = role === 'admin' || (isVerifiedDoctor && doctorDataRoutes.has(normalizedPath));
    if (!canFetchPatients) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/patients`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (response.ok) {
        try {
          const data = await response.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          setPatients(items);
          logger.info('Đã tìm nạp bệnh nhân:', items.length, 'bản ghi');
        } catch(e) {
          logger.error("Định dạng JSON không hợp lệ");
        }
      } else {
        logger.warn('Tìm nạp bệnh nhân thất bại:', response.status);
      }
    } catch (err) {
      logger.error('Không thể tìm nạp bệnh nhân:', err);
    }
  }, [accessToken, role, user, normalizedPath]);

  const fetchAlerts = useCallback(async () => {
    const isVerifiedDoctor = role === 'doctor' && Boolean(user?.profile_completed && user?.is_verified);
    if (role === 'doctor' && !isVerifiedDoctor) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/alerts`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (response.ok) {
        try {
          const data = await response.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          setAlerts(items);
          logger.info('Đã tìm nạp cảnh báo:', items.length, 'bản ghi');
        } catch(e) {
          logger.error("Định dạng JSON không hợp lệ");
        }
      } else {
        logger.warn('Tìm nạp cảnh báo thất bại:', response.status);
      }
    } catch (err) {
      logger.error('Không thể tìm nạp cảnh báo:', err);
    }
  }, [accessToken, role, user]);

  const fetchDoctors = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/doctors`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (response.ok) {
        try {
          const data = await response.json();
          const items = Array.isArray(data) ? data : (data.items || []);
          setDoctors(items);
          logger.info('Đã tìm nạp bác sĩ:', items.length, 'bản ghi');
        } catch(e) {
          logger.error("Định dạng JSON không hợp lệ");
        }
      } else {
        logger.warn('Tìm nạp bác sĩ thất bại:', response.status);
      }
    } catch (err) {
      logger.error('Không thể tìm nạp bác sĩ:', err);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const isVerifiedDoctor = role === 'doctor' && Boolean(user?.profile_completed && user?.is_verified);
    const canFetchAlerts =
      role !== 'doctor' || isVerifiedDoctor;
    const doctorDataRoutes = new Set([
      '/doctor',
      '/doctor/dashboard',
      '/doctor/patients',
      '/doctor/medical-records',
      '/doctor/ai-assistant',
      '/doctor/chatbot',
      '/doctor/appointments',
      '/doctor/reports',
      '/doctor/realtime-monitoring',
      '/doctor/chat',
      '/doctor/messages',
    ]);
    const canFetchPatients =
      role === 'admin' || (isVerifiedDoctor && doctorDataRoutes.has(normalizedPath));

    if (canFetchAlerts) {
      fetchAlerts();
    }
    if (canFetchPatients) {
      fetchPatients();
    }
    if (role === 'admin') {
      fetchDoctors();
    }
  }, [accessToken, role, user, fetchPatients, fetchAlerts, fetchDoctors]);

  const handleSensorTelemetry = useCallback((data: SensorData) => {
    try {
      if (!data || typeof data !== 'object') return;
      setLatestTelemetry(data);
      if (!data.is_abnormal || !Array.isArray(data.alerts) || data.alerts.length === 0) return;

      const firstAlert = data.alerts[0];
      if (!firstAlert) return;
      const matchingPatient = patientsRef.current.find((patient) => patient.id === data.patient_id);
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

      const isPersistent = ['critical', 'high'].includes(severity.toLowerCase());
      if (bannerTimeoutRef.current !== null) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
      if (!isPersistent) {
        bannerTimeoutRef.current = window.setTimeout(() => {
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
    } catch (err) {
      logger.error('Lỗi khi xử lý thông tin Sensor Telemetry:', err);
    }
  }, [patientsRef]);

  /**
   * Phân phối các thông báo WebSocket đến: SensorData thô, tải trọng
   * health_metrics hoặc emergency_alerts. Cập nhật cả trạng thái
   * telemetry trực tiếp và banner cảnh báo hoạt động.
   */
  const handleRealtimeMessage = useCallback((message: any) => {
    // Các thông báo không có trường type được coi là SensorData thô
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
      const matchingPatient = patientsRef.current.find((patient) => patient.id === alert.patient_id);
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

      const isPersistent = ['critical', 'high'].includes(severity.toLowerCase());
      if (bannerTimeoutRef.current !== null) {
        window.clearTimeout(bannerTimeoutRef.current);
      }
      if (!isPersistent) {
        bannerTimeoutRef.current = window.setTimeout(() => {
          setActiveBanner((prev) => prev && prev.patientId === alert.patient_id && prev.message === alert.message ? null : prev);
        }, 7000);
      }
      setAlerts((prev) => [{ ...alert, full_name: patientName }, ...prev]);
    }
  }, [handleSensorTelemetry]);

  const { isConnected } = useWebSocket(WS_URL, accessToken ? handleRealtimeMessage : undefined, accessToken);

  useEffect(() => {
    logger.info('Kết nối WebSocket:', isConnected ? 'đã kết nối' : 'đã ngắt kết nối');
  }, [isConnected]);

  /**
   * Callback sau khi gửi biểu mẫu Đăng nhập thành công. Chuẩn hóa vai trò,
   * lưu trữ phiên qua AuthContext và điều hướng đến tuyến đường mặc định
   * thích hợp (hoặc buộc đổi mật khẩu nếu được yêu cầu).
   */
  const handleLoginSuccess = (token: string, userData: { id: string; full_name: string; email: string; role: string; must_change_password?: boolean }) => {
    const userRole = normalizeRole(userData.role);
    if (!userRole) {
      throw new Error('Tài khoản chưa được phân quyền');
    }

    const normalizedUser = login(token, { ...userData, role: userRole });
    logger.info('Đăng nhập thành công: vai_trò=%s tên=%s', normalizedUser.role, normalizedUser.full_name);
    if (normalizedUser.must_change_password) {
      navigate('/change-password', true);
    } else {
      navigate(defaultRouteByRole[normalizedUser.role], true);
    }
  };

  const renderPatientList = useCallback(() => {
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
        onViewPatientDetail={setSelectedPatientId}
      />
    );
  }, [selectedPatientId, patients, latestTelemetry, alerts, accessToken, fetchPatients]);

  const routeContent = useMemo(() => {
    switch (normalizedPath) {
      case '/admin':
        return <AdminDashboard patients={patients} alerts={alerts} doctors={doctors} />;
      case '/doctor':
        return <DoctorDashboard patients={patients} alerts={alerts} />;
      case '/patient':
        return <PatientHome latestTelemetry={latestTelemetry} alerts={alerts} isConnected={isConnected} />;
      case '/patient/complete-profile':
        return <PatientCompleteProfile />;
      case '/doctor/complete-profile':
        return <DoctorCompleteProfile />;
      case '/doctor/pending-verification':
        return <DoctorPendingVerification />;
      case '/doctor/verification-rejected':
        return <DoctorVerificationRejected />;
      case '/admin/doctor-verification':
        return <AdminDoctorVerification />;
      case '/patient/chatbot':
        return <PatientChatbot />;
      case '/patient/settings':
        return <PatientSettingsPage navigate={navigate} />;
      case '/admin/dashboard':
        return <AdminDashboard patients={patients} alerts={alerts} doctors={doctors} />;
      case '/admin/cms':
      case '/admin/cms/domain-links':
        return <CmsPage />;
      case '/admin/email':
        return <EmailCmsPage />;
      case '/admin/doctors':
        return <DoctorsManager />;
      case '/admin/users':
        return <UsersManager />;
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
        return <FeatureHub key={normalizedPath} type="devices" role="admin" patients={patients} />;
      case '/admin/cameras':
        return <ApiDataPage key={normalizedPath} title="Quản lý camera" subtitle="Danh sách camera thật từ bảng cameras theo quyền hiện tại." endpoint="/cameras" />;
      case '/admin/reports':
      case '/doctor/reports':
        return <ApiDataPage key={normalizedPath} title="Báo cáo" subtitle="Danh sách báo cáo thật từ bảng reports theo quyền hiện tại." endpoint="/reports" />;
      case '/doctor/dashboard':
        return <DoctorDashboard patients={patients} alerts={alerts} />;
      case '/doctor/appointments':
      case '/patient/appointments':
        return <Appointments patients={patients} role={routeRole || 'patient'} />;
      case '/doctor/prescriptions':
      case '/patient/prescriptions':
        return <ApiDataPage key={normalizedPath} title={getPageMeta(normalizedPath, locale)?.title || ''} subtitle={getPageMeta(normalizedPath, locale)?.subtitle || ''} endpoint="/prescriptions" />;
      case '/doctor/chat':
      case '/doctor/messages':
      case '/patient/chat':
        return <ApiDataPage key={normalizedPath} title={getPageMeta(normalizedPath, locale)?.title || ''} subtitle={getPageMeta(normalizedPath, locale)?.subtitle || ''} endpoint="/chat-messages" />;
      case '/patient/notifications':
        return <ApiDataPage key={normalizedPath} title={getPageMeta(normalizedPath, locale)?.title || ''} subtitle={getPageMeta(normalizedPath, locale)?.subtitle || ''} endpoint="/notifications" />;
      case '/admin/system-logs':
        return <ApiDataPage key={normalizedPath} title={getPageMeta(normalizedPath, locale)?.title || ''} subtitle={getPageMeta(normalizedPath, locale)?.subtitle || ''} endpoint="/audit-logs" />;
      case '/admin/settings':
        return <SystemSettings navigate={navigate} />;
      case '/doctor/settings':
        return <DoctorSettingsPage navigate={navigate} />;
      case '/admin/delete-data':
      case '/doctor/delete-data':
      case '/patient/delete-data':
        return <UserDataDeletionPage />;
      case '/admin/profile':
      case '/doctor/profile':
      case '/patient/profile':
        return <ProfilePage role={routeRole || 'patient'} />;
      case '/doctor/realtime-monitoring':
        return <Dashboard patients={patients} latestTelemetry={latestTelemetry} alerts={alerts} onAddPatientClick={() => navigate('/doctor/patients')} isConnected={isConnected} />;
      case '/patient/home':
      case '/patient/dashboard':
        return <PatientHome latestTelemetry={latestTelemetry} alerts={alerts} isConnected={isConnected} />;
      case '/patient/health':
      case '/patient/metrics':
      case '/patient/history':
        return <PatientHealthPage latestTelemetry={latestTelemetry} alerts={alerts} isConnected={isConnected} navigate={navigate} />;
      default: {
        if (normalizedPath.startsWith('/doctor/medical-records')) {
          return <DoctorMedicalRecordsPage path={normalizedPath} patients={patients.map((patient) => ({ id: patient.id, full_name: patient.full_name }))} navigate={navigate} />;
        }
        if (normalizedPath.startsWith('/patient/medical-records')) {
          return <PatientMedicalRecordsPage path={normalizedPath} navigate={navigate} />;
        }
        if (normalizedPath.startsWith('/admin/medical-records')) {
          return <AdminMedicalRecordsPage path={normalizedPath} patients={patients.map((patient) => ({ id: patient.id, full_name: patient.full_name }))} navigate={navigate} />;
        }
        const meta = getPageMeta(normalizedPath, locale);
        return meta ? <PlaceholderPage title={meta.title} subtitle={meta.subtitle} /> : null;
      }
    }
  }, [alerts, latestTelemetry, normalizedPath, patients, routeRole, selectedPatientId, doctors, isConnected, navigate, renderPatientList, locale]);

  if (loading) {
    return <div className="route-loading">Đang khôi phục phiên đăng nhập...</div>;
  }

  // Xử lý các trang pháp lý công khai (không yêu cầu xác thực)
  if (path === '/privacy') {
    return <PrivacyPolicy />;
  }
  if (path === '/terms') {
    return <TermsOfService />;
  }
  if (path === '/data-deletion') {
    return <UserDataDeletionPage />;
  }

  // Xử lý các trang Register
  if (path === '/register') {
    return <Register role="patient" onRegisterSuccess={() => navigate('/login', true)} onNavigateToLogin={() => navigate('/login')} onGoogleAuthSuccess={handleLoginSuccess} />;
  }
  if (path === '/register-doctor') {
    return <Register role="doctor" onRegisterSuccess={() => navigate('/login-doctor', true)} onNavigateToLogin={() => navigate('/login-doctor')} onGoogleAuthSuccess={handleLoginSuccess} />;
  }
  if (path === '/register-admin') {
    navigate('/login-admin', true);
    return null;
  }

  // Xử lý các trang Forgot Password / Reset Password
  if (path === '/forgot-password' || path === '/reset-password') {
    return <ForgotPassword role="patient" onNavigateToLogin={() => navigate('/login')} />;
  }
  if (path === '/forgot-password-doctor' || path === '/reset-password-doctor') {
    return <ForgotPassword role="doctor" onNavigateToLogin={() => navigate('/login-doctor')} />;
  }
  if (path === '/forgot-password-admin' || path === '/reset-password-admin') {
    return <ForgotPassword role="admin" onNavigateToLogin={() => navigate('/login-admin')} />;
  }

  if (path === '/change-password') {
    if (!isAuthenticated || !role) {
      return null;
    }
    return <ChangePassword onNavigateNext={(nextRole) => {
      const targetRole = nextRole || role;
      navigate(targetRole ? defaultRouteByRole[targetRole] : getLastLoginRoute(), true);
    }} />;
  }

  if (['/login', '/login-doctor', '/login-admin'].includes(path) || (!routeRole && path !== '/change-password')) {
    if (!isAuthenticated) {
      let targetRole: UserRole = 'patient';
      if (path === '/login-doctor') {
        targetRole = 'doctor';
      } else if (path === '/login-admin') {
        targetRole = 'admin';
      }

      return <Login 
        role={targetRole}
        onLoginSuccess={handleLoginSuccess} 
        onNavigateToRegister={targetRole === 'admin' ? () => {} : (targetRole === 'doctor' ? () => navigate('/register-doctor') : () => navigate('/register'))} 
        onNavigateToForgotPassword={targetRole === 'admin' ? () => navigate('/forgot-password-admin') : (targetRole === 'doctor' ? () => navigate('/forgot-password-doctor') : () => navigate('/forgot-password'))}
      />;
    }
    return null;
  }

  if (!routeContent) {
    return null;
  }

  const layoutProps = {
    currentPath: normalizedPath,
    navigate,
    theme,
    onToggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    isConnected,
  };

  const isOnboardingOrStatusRoute = [
    '/patient/complete-profile',
    '/doctor/complete-profile',
    '/doctor/pending-verification',
    '/doctor/verification-rejected'
  ].includes(normalizedPath);

  const layout = isOnboardingOrStatusRoute
    ? <div className="fullscreen-onboarding-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '24px' }}>{routeContent}</div>
    : routeRole === 'admin'
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

/**
 * Xuất gốc. Bọc toàn bộ cây ứng dụng bên trong AuthProvider để
 * mọi thành phần con có thể tiêu thụ context xác thực.
 */
export const App: React.FC = () => (
  <LocaleProvider>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  </LocaleProvider>
);

export default App;
