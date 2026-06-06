import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Languages, Lock, Settings, Shield, UserRound, ArrowRight, Cpu, Trash2, PlusCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLocale, type Locale } from '../i18n/locale';
import { buildApiUrl } from '../config';

type PatientPreferences = {
  language: Locale;
  vitalAlerts: boolean;
  appointmentReminders: boolean;
  doctorMessages: boolean;
  emailSummaries: boolean;
  shareHealthSummary: boolean;
};

const STORAGE_KEY = 'cardioguard_patient_settings';

const defaultPreferences: PatientPreferences = {
  language: 'vi',
  vitalAlerts: true,
  appointmentReminders: true,
  doctorMessages: true,
  emailSummaries: false,
  shareHealthSummary: false,
};

const loadPreferences = (): PatientPreferences => {
  if (typeof window === 'undefined') return defaultPreferences;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPreferences;
    return { ...defaultPreferences, ...JSON.parse(raw) };
  } catch {
    return defaultPreferences;
  }
};

const SettingSwitch: React.FC<{
  checked: boolean;
  label: string;
  description: string;
  onChange: (value: boolean) => void;
}> = ({ checked, label, description, onChange }) => (
  <label className="settings-switch-row">
    <div>
      <div className="settings-switch-label">{label}</div>
      <div className="settings-switch-desc">{description}</div>
    </div>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  </label>
);

export const PatientSettingsPage: React.FC<{ navigate: (path: string, replace?: boolean) => void }> = ({ navigate }) => {
  const { user, accessToken } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const [preferences, setPreferences] = useState<PatientPreferences>(loadPreferences);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Trạng thái thiết bị IoT
  const [device, setDevice] = useState<any | null>(null);
  const [macInput, setMacInput] = useState('');
  const [deviceNameInput, setDeviceNameInput] = useState('');
  const [isLoadingDevice, setIsLoadingDevice] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Lấy thông tin thiết bị đã liên kết
  const fetchDevice = async () => {
    if (!accessToken) {
      setIsLoadingDevice(false);
      return;
    }
    try {
      const response = await fetch(buildApiUrl('/devices'), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        // Lọc thiết bị của bệnh nhân hiện tại có địa chỉ MAC
        const paired = data.items?.find((d: any) => d.patient_id === user?.id && d.device_mac);
        setDevice(paired || null);
      }
    } catch (err) {
      console.error('Lỗi khi lấy thông tin thiết bị:', err);
    } finally {
      setIsLoadingDevice(false);
    }
  };

  useEffect(() => {
    fetchDevice();
  }, [accessToken, user?.id]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!macInput.trim()) {
      setActionError(locale === 'en' ? 'Please enter device MAC address.' : 'Vui lòng nhập địa chỉ MAC của thiết bị.');
      return;
    }
    setIsActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(buildApiUrl('/iot/devices/claim'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          device_mac: macInput.trim(),
          device_name: deviceNameInput.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || (locale === 'en' ? 'Failed to link device.' : 'Liên kết thiết bị thất bại.'));
      }
      setDevice(data.device);
      setMacInput('');
      setDeviceNameInput('');
      alert(data.message || (locale === 'en' ? 'Device linked successfully!' : 'Liên kết thiết bị thành công!'));
    } catch (err: any) {
      setActionError(err.message || (locale === 'en' ? 'Server connection error.' : 'Lỗi kết nối máy chủ.'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnclaim = async () => {
    if (!device || !device.device_mac) return;
    const confirmMsg = locale === 'en'
      ? 'Are you sure you want to unlink this device? Realtime heart rate data will no longer sync to your account.'
      : 'Bạn có chắc chắn muốn hủy liên kết thiết bị này? Dữ liệu nhịp tim realtime sẽ không được đồng bộ vào tài khoản của bạn nữa.';
    if (!window.confirm(confirmMsg)) {
      return;
    }
    setIsActionLoading(true);
    setActionError(null);
    try {
      const response = await fetch(buildApiUrl('/iot/devices/unclaim'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          device_mac: device.device_mac,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || (locale === 'en' ? 'Failed to unlink device.' : 'Hủy liên kết thất bại.'));
      }
      setDevice(null);
      alert(data.message || (locale === 'en' ? 'Device unlinked successfully!' : 'Đã hủy liên kết thiết bị thành công!'));
    } catch (err: any) {
      setActionError(err.message || (locale === 'en' ? 'Server connection error.' : 'Lỗi kết nối máy chủ.'));
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    setPreferences((current) => (current.language === locale ? current : { ...current, language: locale }));
  }, [locale]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    if (locale !== preferences.language) {
      setLocale(preferences.language);
    }
    setSavedAt(new Date().toLocaleString(preferences.language === 'en' ? 'en-US' : 'vi-VN'));
  }, [preferences, locale, setLocale]);

  const togglePreference = (key: keyof Omit<PatientPreferences, 'language'>, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const languageOptions = useMemo(() => ([
    { value: 'vi' as const, label: locale === 'en' ? 'Vietnamese' : 'Tiếng Việt' },
    { value: 'en' as const, label: locale === 'en' ? 'English' : 'Tiếng Anh' },
  ]), [locale]);

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('patient_settings_title')}</h1>
          <p className="page-subtitle">{t('patient_settings_subtitle')}</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Languages size={18} />
            <div>
              <h3>{t('language_settings')}</h3>
              <p>{locale === 'en' ? 'Choose the display language for the entire interface.' : 'Chọn ngôn ngữ hiển thị cho toàn bộ giao diện.'}</p>
            </div>
          </div>
          <div className="settings-segmented-control" role="group" aria-label={t('language_settings')}>
            {languageOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`settings-segmented-btn ${preferences.language === option.value ? 'active' : ''}`}
                onClick={() => setPreferences((current) => ({ ...current, language: option.value }))}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="settings-helper-note">
            {preferences.language === 'vi'
              ? 'Giao diện sẽ ưu tiên tiếng Việt trên thanh điều hướng, tiêu đề và nội dung cài đặt.'
              : 'The interface will prefer English on navigation, headers, and settings text.'}
          </div>
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Bell size={18} />
            <div>
              <h3>{t('notification_settings')}</h3>
              <p>{locale === 'en' ? 'Turn patient account alerts on or off.' : 'Bật hoặc tắt các loại cảnh báo dành cho tài khoản bệnh nhân.'}</p>
            </div>
          </div>
          <div className="settings-switch-list">
            <SettingSwitch
              checked={preferences.vitalAlerts}
              label={locale === 'en' ? 'Vital sign alerts' : 'Cảnh báo chỉ số sinh hiệu'}
              description={locale === 'en' ? 'Receive urgent alerts for heart rate, SpO2, and blood pressure.' : 'Nhận cảnh báo khẩn cấp cho nhịp tim, SpO2 và huyết áp.'}
              onChange={(value) => togglePreference('vitalAlerts', value)}
            />
            <SettingSwitch
              checked={preferences.appointmentReminders}
              label={locale === 'en' ? 'Appointment reminders' : 'Nhắc lịch hẹn'}
              description={locale === 'en' ? 'Get reminders before upcoming appointments.' : 'Nhận thông báo trước các lịch hẹn sắp tới.'}
              onChange={(value) => togglePreference('appointmentReminders', value)}
            />
            <SettingSwitch
              checked={preferences.doctorMessages}
              label={locale === 'en' ? 'Doctor messages' : 'Tin nhắn từ bác sĩ'}
              description={locale === 'en' ? 'Notify when your doctor sends a message.' : 'Thông báo khi bác sĩ gửi tin nhắn.'}
              onChange={(value) => togglePreference('doctorMessages', value)}
            />
            <SettingSwitch
              checked={preferences.emailSummaries}
              label={locale === 'en' ? 'Email summaries' : 'Tóm tắt qua email'}
              description={locale === 'en' ? 'Receive periodic health summaries by email.' : 'Nhận tóm tắt sức khỏe định kỳ qua email.'}
              onChange={(value) => togglePreference('emailSummaries', value)}
            />
          </div>
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Shield size={18} />
            <div>
              <h3>{t('security')}</h3>
              <p>{locale === 'en' ? 'Configure privacy and account security actions.' : 'Thiết lập quyền riêng tư và thao tác bảo mật tài khoản.'}</p>
            </div>
          </div>
          <div className="settings-switch-list">
            <SettingSwitch
              checked={preferences.shareHealthSummary}
              label={locale === 'en' ? 'Share health summary' : 'Chia sẻ tóm tắt sức khỏe'}
              description={locale === 'en' ? 'Allow doctors to see your latest health summary quickly.' : 'Cho phép bác sĩ xem tóm tắt sức khỏe gần nhất của bạn nhanh hơn.'}
              onChange={(value) => togglePreference('shareHealthSummary', value)}
            />
          </div>
          <div className="settings-action-grid" style={{ marginBottom: '1.25rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/change-password')}>
              <Lock size={16} /> {t('change_password')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/patient/profile')}>
              <UserRound size={16} /> {t('edit_profile')}
            </button>
          </div>
          <div 
            style={{ 
              borderTop: '1px solid var(--glass-border)', 
              paddingTop: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {locale === 'en' ? 'Data Requests' : 'Yêu cầu dữ liệu'}
            </h4>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/patient/delete-data')}
              style={{ justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem' }}
            >
              <span>{locale === 'en' ? 'Data Deletion Guide' : 'Hướng dẫn xóa dữ liệu'}</span>
              <ArrowRight size={16} style={{ color: 'var(--color-primary)' }} />
            </button>
          </div>
        </section>

        {/* Cấu hình phần cứng IoT */}
        <section className="panel settings-card">
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
            .spin-animated {
              animation: spin 1s linear infinite;
            }
          `}</style>
          <div className="settings-card-heading">
            <Cpu size={18} />
            <div>
              <h3>{locale === 'en' ? 'IoT Medical Device' : 'Thiết bị y tế IoT (Phần cứng)'}</h3>
              <p>
                {locale === 'en'
                  ? 'Link your CardioGuard health monitoring device (ESP32-S3) via MAC address.'
                  : 'Liên kết thiết bị theo dõi sức khỏe CardioGuard (ESP32-S3) bằng địa chỉ MAC.'}
              </p>
            </div>
          </div>

          {isLoadingDevice ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', padding: '12px 0' }}>
              <Loader2 size={16} className="spin-animated" style={{ color: 'var(--color-primary)' }} />
              <span>{locale === 'en' ? 'Checking linked devices...' : 'Đang kiểm tra thiết bị đã liên kết...'}</span>
            </div>
          ) : device ? (
            <div className="settings-summary" style={{ gap: '12px' }}>
              <div style={{ background: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.15)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Cpu size={14} style={{ color: 'var(--color-primary)' }} />
                    {device.device_name || 'CardioGuard Prototype'}
                  </span>
                  <span className={`metric-status-badge ${device.status === 'online' ? 'normal' : 'high'}`} style={{ textTransform: 'capitalize' }}>
                    {device.status || 'offline'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{locale === 'en' ? 'MAC Address' : 'Địa chỉ MAC'}</span>
                  <strong className="tabular-nums">{device.device_mac}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{locale === 'en' ? 'Type' : 'Loại'}</span>
                  <span>{device.device_type || 'Wearable'}</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleUnclaim}
                disabled={isActionLoading}
                style={{
                  width: '100%',
                  color: 'var(--color-critical)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '12px',
                  padding: '12px'
                }}
              >
                {isActionLoading ? (
                  <>
                    <Loader2 size={16} className="spin-animated" />
                    {locale === 'en' ? 'Unlinking...' : 'Đang hủy liên kết...'}
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    {locale === 'en' ? 'Unlink Device' : 'Hủy liên kết thiết bị'}
                  </>
                )}
              </button>
            </div>
          ) : (
            <form onSubmit={handleClaim} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="device-mac" className="settings-switch-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {locale === 'en' ? 'Device MAC Address' : 'Địa chỉ MAC của thiết bị'}
                </label>
                <input
                  type="text"
                  id="device-mac"
                  placeholder="Ví dụ: ac:27:6e:b1:0a:18"
                  value={macInput}
                  onChange={(e) => setMacInput(e.target.value)}
                  disabled={isActionLoading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label htmlFor="device-name" className="settings-switch-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {locale === 'en' ? 'Device Name (Optional)' : 'Tên thiết bị (Tùy chọn)'}
                </label>
                <input
                  type="text"
                  id="device-name"
                  placeholder="Ví dụ: ESP32 Wearable"
                  value={deviceNameInput}
                  onChange={(e) => setDeviceNameInput(e.target.value)}
                  disabled={isActionLoading}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border)',
                    background: 'var(--glass-bg)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                />
              </div>

              {actionError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-critical)', fontSize: '0.85rem', padding: '10px 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                  <AlertCircle size={14} />
                  <span>{actionError}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isActionLoading}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  gap: '8px',
                  borderRadius: '12px',
                  padding: '12px'
                }}
              >
                {isActionLoading ? (
                  <>
                    <Loader2 size={16} className="spin-animated" />
                    {locale === 'en' ? 'Linking...' : 'Đang liên kết...'}
                  </>
                ) : (
                  <>
                    <PlusCircle size={16} />
                    {locale === 'en' ? 'Link Device' : 'Liên kết thiết bị'}
                  </>
                )}
              </button>
            </form>
          )}
        </section>

        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Settings size={18} />
            <div>
              <h3>{t('preferences')}</h3>
              <p>{locale === 'en' ? 'Account information and saved preference status.' : 'Thông tin tài khoản và trạng thái lưu cấu hình.'}</p>
            </div>
          </div>
          <div className="settings-summary">
            <div>
              <span>Email</span>
              <strong>{user?.email || '—'}</strong>
            </div>
            <div>
              <span>Họ tên</span>
              <strong>{user?.full_name || '—'}</strong>
            </div>
            <div>
              <span>Ngôn ngữ</span>
              <strong>{preferences.language === 'vi' ? 'Tiếng Việt' : 'English'}</strong>
            </div>
            <div>
              <span>Trạng thái</span>
              <strong className="settings-saved-indicator">
                <CheckCircle2 size={14} /> {savedAt ? (locale === 'en' ? `Saved at ${savedAt}` : `Đã lưu lúc ${savedAt}`) : (locale === 'en' ? 'Not saved yet' : 'Chưa lưu')}
              </strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
