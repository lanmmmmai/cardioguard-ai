import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Languages, Lock, Settings, Shield, UserRound, ArrowRight } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLocale, type Locale } from '../i18n/locale';

type DoctorPreferences = {
  language: Locale;
  emailAlerts: boolean;
  patientMessages: boolean;
};

const STORAGE_KEY = 'cardioguard_doctor_settings';

const defaultPreferences: DoctorPreferences = {
  language: 'vi',
  emailAlerts: true,
  patientMessages: true,
};

const loadPreferences = (): DoctorPreferences => {
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

export const DoctorSettingsPage: React.FC<{ navigate: (path: string, replace?: boolean) => void }> = ({ navigate }) => {
  const { user } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const [preferences, setPreferences] = useState<DoctorPreferences>(loadPreferences);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setPreferences((current) => (current.language === locale ? current : { ...current, language: locale }));
  }, [locale]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    setLocale(preferences.language);
    setSavedAt(new Date().toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN'));
  }, [preferences, locale, setLocale]);

  const togglePreference = (key: keyof Omit<DoctorPreferences, 'language'>, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const languageOptions = useMemo(() => ([
    { value: 'vi' as const, label: locale === 'en' ? 'Vietnamese' : 'Tiếng Việt' },
    { value: 'en' as const, label: locale === 'en' ? 'English' : 'Tiếng Anh' },
  ]), [locale]);

  const isVi = locale === 'vi';

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isVi ? 'Cài đặt bác sĩ' : 'Doctor Settings'}</h1>
          <p className="page-subtitle">
            {isVi 
              ? 'Quản lý cấu hình ngôn ngữ, thông báo cảnh báo và thiết lập bảo mật tài khoản bác sĩ.' 
              : 'Manage language preferences, alert notifications, and doctor account security.'}
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Language Settings Card */}
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Languages size={18} />
            <div>
              <h3>{t('language_settings')}</h3>
              <p>{isVi ? 'Chọn ngôn ngữ hiển thị cho giao diện bác sĩ.' : 'Choose the display language for the doctor interface.'}</p>
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

        {/* Notifications Card */}
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Bell size={18} />
            <div>
              <h3>{isVi ? 'Thiết lập thông báo' : 'Notification Settings'}</h3>
              <p>{isVi ? 'Bật hoặc tắt các cảnh báo cho tài khoản bác sĩ.' : 'Enable or disable alerts for the doctor account.'}</p>
            </div>
          </div>
          <div className="settings-switch-list">
            <SettingSwitch
              checked={preferences.emailAlerts}
              label={isVi ? 'Cảnh báo lâm sàng qua Email' : 'Clinical Email Alerts'}
              description={isVi ? 'Nhận email cảnh báo khi chỉ số sinh hiệu của bệnh nhân phụ trách vượt ngưỡng.' : 'Receive email alerts when monitored patient vitals cross safe thresholds.'}
              onChange={(value) => togglePreference('emailAlerts', value)}
            />
            <SettingSwitch
              checked={preferences.patientMessages}
              label={isVi ? 'Tin nhắn từ bệnh nhân' : 'Patient Messages'}
              description={isVi ? 'Thông báo khi bệnh nhân gửi tin nhắn tư vấn mới.' : 'Notify when patients send a new consultation message.'}
              onChange={(value) => togglePreference('patientMessages', value)}
            />
          </div>
        </section>

        {/* Security & Deletion Card */}
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Shield size={18} />
            <div>
              <h3>{isVi ? 'Bảo mật & Quyền riêng tư' : 'Security & Privacy'}</h3>
              <p>{isVi ? 'Thiết lập quyền riêng tư và thao tác bảo mật tài khoản.' : 'Configure privacy and account security actions.'}</p>
            </div>
          </div>
          
          <div className="settings-action-grid" style={{ marginBottom: '1.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={() => navigate('/change-password')}>
              <Lock size={16} /> {t('change_password')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/doctor/profile')}>
              <UserRound size={16} /> {isVi ? 'Chỉnh sửa hồ sơ' : 'Edit Profile'}
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
              {isVi ? 'Yêu cầu dữ liệu' : 'Data Requests'}
            </h4>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => navigate('/doctor/delete-data')}
              style={{ justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px', fontSize: '0.85rem' }}
            >
              <span>{isVi ? 'Hướng dẫn xóa dữ liệu người dùng' : 'User Data Deletion Guide'}</span>
              <ArrowRight size={16} style={{ color: 'var(--color-primary)' }} />
            </button>
          </div>
        </section>

        {/* Preferences Summary Card */}
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <Settings size={18} />
            <div>
              <h3>{isVi ? 'Thông tin thiết lập' : 'Settings Summary'}</h3>
              <p>{isVi ? 'Thông tin tài khoản và trạng thái lưu cấu hình.' : 'Account information and saved preference status.'}</p>
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

export default DoctorSettingsPage;
