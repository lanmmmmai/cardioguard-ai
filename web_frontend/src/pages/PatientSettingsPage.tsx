import React, { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, Languages, Lock, Settings, Shield, UserRound } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useLocale, type Locale } from '../i18n/locale';

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
  const { user } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const [preferences, setPreferences] = useState<PatientPreferences>(loadPreferences);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setPreferences((current) => (current.language === locale ? current : { ...current, language: locale }));
  }, [locale]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    setLocale(preferences.language);
    setSavedAt(new Date().toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN'));
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
          <div className="settings-action-grid">
            <button type="button" className="btn btn-primary" onClick={() => navigate('/change-password')}>
              <Lock size={16} /> {t('change_password')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/patient/profile')}>
              <UserRound size={16} /> {t('edit_profile')}
            </button>
          </div>
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
