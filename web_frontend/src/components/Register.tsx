/**
 * @purpose Đăng ký bệnh nhân hai bước: bước biểu mẫu sau đó bước xác minh OTP.
 * @workflow Bước 1 xác thực các trường (họ tên, Gmail, quy tắc mật khẩu) sau đó yêu cầu
 *           OTP qua /auth/register/request-otp. Bước 2 thu thập OTP 6 chữ số với các ô
 *           nhập riêng lẻ và gửi đến /auth/register. Khi thành công, điều hướng đến đăng nhập.
 * @relationships Component cha: App (gọi onRegisterSuccess/onNavigateToLogin); Sử dụng: passwordPolicy util.
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  Activity, ArrowLeft, CheckCircle2, Lock, Mail, ShieldCheck,
  User, Loader2, Phone, Stethoscope, Building,
} from 'lucide-react';
import { API_URL, GOOGLE_CLIENT_ID, FACEBOOK_APP_ID } from '../config';
import { isStrongPassword, getPasswordPolicyMessage } from '../utils/passwordPolicy';
import { UserRole } from '../auth/roles';
import { useLocale } from '../i18n/locale';
import { readJsonResponse } from '../utils/response';
import { LegalFooterLinks } from './LegalFooterLinks';
import { SocialLoginIcons } from './SocialLoginIcons';
import { exchangeGoogleIdToken, type GoogleAuthUser } from '../lib/googleAuth';
import { exchangeFacebookToken } from '../lib/facebookAuth';

interface RegisterProps {
  role: UserRole;
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
  onGoogleAuthSuccess: (token: string, user: GoogleAuthUser) => void;
}

const fullNamePattern = /^[A-Za-zÀ-ỹ]+(?:[ '-][A-Za-zÀ-ỹ]+)+$/;
const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const Register: React.FC<RegisterProps> = ({ role, onRegisterSuccess, onNavigateToLogin, onGoogleAuthSuccess }) => {
  const { locale } = useLocale();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [department, setDepartment] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const timerRef = useRef<any>(null);

  const showGoogleRegister = role !== 'admin' && Boolean(GOOGLE_CLIENT_ID);
  const showFacebookRegister = role !== 'admin';

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const passwordRules = [
    { label: 'Tối thiểu 8 ký tự', valid: password.length >= 8 },
    { label: 'Có ít nhất 1 chữ hoa', valid: /[A-Z]/.test(password) },
    { label: 'Có chữ và số', valid: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: 'Có ký tự đặc biệt', valid: /[^A-Za-z\d]/.test(password) },
  ];

  const validateForm = () => {
    const normalizedName = normalizeName(fullName);
    if (!agreed) return 'Bạn phải đồng ý với Chính sách bảo mật và Điều khoản dịch vụ';
    if (!normalizedName || !email || !password || !confirmPassword) return 'Vui lòng nhập đầy đủ thông tin';
    if (role === 'doctor' && (!phone || !specialty || !department)) return 'Vui lòng nhập đầy đủ thông tin bác sĩ';
    if (!fullNamePattern.test(normalizedName)) return 'Họ tên phải có ít nhất 2 từ, chỉ gồm chữ cái';
    if (!email.toLowerCase().endsWith('@gmail.com')) return 'Vui lòng dùng địa chỉ Gmail để nhận OTP';
    if (!isStrongPassword(password)) return getPasswordPolicyMessage(locale);
    if (password !== confirmPassword) return 'Mật khẩu nhập lại không khớp';
    return null;
  };

  const requestOtp = async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    setError(null); setSuccess(null); setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: normalizeName(fullName),
          email: email.toLowerCase(),
          role,
          phone: role === 'doctor' ? phone : undefined,
          specialty: role === 'doctor' ? specialty : undefined,
          department: role === 'doctor' ? department : undefined,
        }),
      });
      const data = await readJsonResponse<{ detail?: string; email_sent?: boolean; email?: string }>(response);
      if (!response.ok) throw new Error(data.detail || 'Không gửi được OTP. Vui lòng thử lại');
      setStep('otp');
      setOtp('');
      setSuccess(
        data.email_sent === false
          ? 'Môi trường dev chưa cấu hình gửi email. Vui lòng kiểm tra cấu hình SMTP/Brevo.'
          : `Đã gửi OTP tới ${data.email || email.toLowerCase()}. Kiểm tra hộp thư hoặc spam.`
      );
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setError(null); setSuccess(null); setIsLoading(true);
    try {
      const data = await exchangeGoogleIdToken(idToken, role);
      onGoogleAuthSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập Google thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookToken = async (accessToken: string) => {
    setError(null); setSuccess(null); setIsLoading(true);
    try {
      const data = await exchangeFacebookToken(accessToken, role);
      onGoogleAuthSuccess(data.access_token, data.user as GoogleAuthUser);
    } catch (err: any) {
      setError(err?.message || 'Đăng ký Facebook thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = otp.padEnd(6, ' ').split('');
    nextOtp[index] = digit || ' ';
    setOtp(nextOtp.join('').replace(/\s/g, ''));
    if (digit && index < 5) otpInputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpInputRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedOtp = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setOtp(pastedOtp);
    window.setTimeout(() => otpInputRefs.current[Math.min(pastedOtp.length, 5)]?.focus(), 0);
  };

  const confirmOtpAndRegister = async () => {
    const validationError = validateForm();
    if (validationError) { setError(validationError); return; }
    if (!/^\d{6}$/.test(otp.trim())) { setError('OTP phải gồm đúng 6 chữ số'); return; }
    setError(null); setSuccess(null); setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: normalizeName(fullName),
          email: email.toLowerCase(),
          password,
          otp: otp.trim(),
          role,
          phone: role === 'doctor' ? phone : undefined,
          specialty: role === 'doctor' ? specialty : undefined,
          department: role === 'doctor' ? department : undefined,
          agree_privacy: agreed,
          agree_terms: agreed,
          consent_version: '1.0',
        }),
      });
      let data;
      try { data = await response.json(); } catch { throw new Error('Lỗi định dạng phản hồi từ server'); }
      if (!response.ok) throw new Error(data.detail || 'Đăng ký thất bại. Email có thể đã tồn tại hoặc OTP không đúng');
      setSuccess(`Đăng ký tài khoản ${role === 'doctor' ? 'bác sĩ' : 'bệnh nhân'} thành công! Đang chuyển sang đăng nhập...`);
      timerRef.current = setTimeout(onRegisterSuccess, 1800);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-shell-body">
        <div className="panel auth-panel register-panel">
          <div className="register-card-topline" />

          {/* Brand */}
          <div className="auth-brand register-brand">
            <div className="brand-icon register-brand-icon">
              <Activity className="beat-animated" size={22} />
            </div>
            <span className="brand-name">CardioGuard AI</span>
          </div>

          <h2 className="auth-title">{role === 'doctor' ? 'Đăng Ký Bác Sĩ' : 'Đăng Ký Bệnh Nhân'}</h2>
          <p className="auth-subtitle register-subtitle">
            {role === 'doctor'
              ? 'Tạo tài khoản bác sĩ với xác minh qua Gmail OTP.'
              : 'Tạo tài khoản bệnh nhân với xác minh qua Gmail OTP.'}
          </p>

          {/* Stepper */}
          <div className="auth-stepper">
            <div className={`auth-step ${step === 'form' ? 'active' : 'done'}`}>
              <span>1</span><p>Thông tin</p>
            </div>
            <div className="auth-step-line" />
            <div className={`auth-step ${step === 'otp' ? 'active' : ''}`}>
              <span>2</span><p>Xác minh OTP</p>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="auth-error-strip">
              <span className="auth-error-label">Lỗi:</span> {error}
            </div>
          )}
          {success && (
            <div className="auth-success-strip">{success}</div>
          )}

          {/* Social register */}
          <SocialLoginIcons
            showGoogle={showGoogleRegister}
            showFacebook={showFacebookRegister}
            googleClientId={GOOGLE_CLIENT_ID}
            facebookAppId={FACEBOOK_APP_ID}
            facebookRole={role !== 'admin' ? role : undefined}
            disabled={isLoading}
            label="Đăng ký bằng phương thức khác"
            onGoogleCredential={handleGoogleCredential}
            onFacebookToken={handleFacebookToken}
          />

          {/* Helper hint */}
          <div className="auth-helper-card">
            <ShieldCheck size={16} />
            <span>Điền thông tin bên dưới rồi bấm <strong>Đăng Ký</strong> để nhận OTP qua Gmail.</span>
          </div>

          {/* Form */}
          <form onSubmit={(e) => { e.preventDefault(); requestOtp(); }} className="register-form">

            <div className="form-group">
              <label htmlFor="reg-fullName">{role === 'doctor' ? 'Họ và tên bác sĩ' : 'Họ và tên'}</label>
              <div className="input-icon-wrap">
                <User size={16} className="input-icon" />
                <input
                  id="reg-fullName" type="text" className="form-control input-with-icon"
                  placeholder={role === 'doctor' ? 'Bác sĩ Nguyễn Văn An' : 'Nguyễn Văn An'}
                  value={fullName} onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading} required
                />
              </div>
            </div>

            {role === 'doctor' && (
              <div className="reg-doctor-fields">
                <div className="form-group">
                  <label htmlFor="reg-phone">Số điện thoại</label>
                  <div className="input-icon-wrap">
                    <Phone size={16} className="input-icon" />
                    <input
                      id="reg-phone" type="text" className="form-control input-with-icon"
                      placeholder="0912 345 678" value={phone}
                      onChange={(e) => setPhone(e.target.value)} disabled={isLoading} required
                    />
                  </div>
                </div>
                <div className="reg-2col">
                  <div className="form-group">
                    <label htmlFor="reg-specialty">Chuyên khoa</label>
                    <div className="input-icon-wrap">
                      <Stethoscope size={16} className="input-icon" />
                      <input
                        id="reg-specialty" type="text" className="form-control input-with-icon"
                        placeholder="Tim mạch" value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)} disabled={isLoading} required
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="reg-department">Khoa / Phòng ban</label>
                    <div className="input-icon-wrap">
                      <Building size={16} className="input-icon" />
                      <input
                        id="reg-department" type="text" className="form-control input-with-icon"
                        placeholder="Khoa Tim mạch" value={department}
                        onChange={(e) => setDepartment(e.target.value)} disabled={isLoading} required
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="reg-email">Gmail nhận OTP</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="input-icon" />
                <input
                  id="reg-email" type="email" className="form-control input-with-icon"
                  placeholder={role === 'doctor' ? 'bacsi@gmail.com' : 'benhnhan@gmail.com'}
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading} required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Mật khẩu</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  id="reg-password" type="password" className="form-control input-with-icon"
                  placeholder="Ví dụ: Cardio@123" value={password}
                  onChange={(e) => setPassword(e.target.value)} disabled={isLoading} required
                />
              </div>
              <div className="password-rule-list">
                {passwordRules.map((rule) => (
                  <div key={rule.label} className={`password-rule ${rule.valid ? 'valid' : ''}`}>
                    <CheckCircle2 size={12} /><span>{rule.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="reg-confirm">Nhập lại mật khẩu</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  id="reg-confirm" type="password" className="form-control input-with-icon"
                  placeholder="Nhập lại mật khẩu" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} required
                />
              </div>
            </div>

            {/* Consent */}
            <div className="consent-row">
              <input
                id="reg-consent" type="checkbox" className="consent-checkbox"
                checked={agreed} onChange={(e) => setAgreed(e.target.checked)} disabled={isLoading}
              />
              <label htmlFor="reg-consent" className="consent-label">
                Tôi đồng ý với{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="auth-link">Chính sách bảo mật</a>
                {' '}và{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="auth-link">Điều khoản dịch vụ</a>.
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={isLoading || !agreed}
            >
              {isLoading
                ? <><Loader2 size={16} className="spin-icon" /> Đang gửi OTP...</>
                : <><ShieldCheck size={16} /> Đăng Ký &amp; Gửi OTP</>
              }
            </button>
          </form>

          <div className="auth-footer">
            Đã có tài khoản?{' '}
            <span className="auth-link" onClick={onNavigateToLogin}>Đăng nhập ngay</span>
          </div>
        </div>
      </div>

      {/* OTP modal */}
      {step === 'otp' && (
        <div className="modal-overlay">
          <div className="modal-content otp-modal-card">
            <button
              type="button" className="otp-back-btn"
              onClick={() => { setStep('form'); setOtp(''); setSuccess(null); }}
              disabled={isLoading}
            >
              <ArrowLeft size={15} /> Sửa thông tin
            </button>

            <div className="auth-brand otp-modal-brand">
              <div className="brand-icon otp-shield-icon"><ShieldCheck size={20} /></div>
            </div>

            <h2 className="auth-title">Nhập Mã OTP</h2>
            <p className="auth-subtitle otp-modal-subtitle">
              Mã xác minh đã gửi tới
              <span className="otp-email-chip">{email.toLowerCase()}</span>
            </p>

            {error && <div className="auth-error-strip" style={{ marginBottom: '1rem' }}><span className="auth-error-label">Lỗi:</span> {error}</div>}
            {success && <div className="auth-success-strip" style={{ marginBottom: '1rem' }}>{success}</div>}

            <div className="otp-digit-grid" aria-label="Nhập mã OTP 6 số">
              {Array.from({ length: 6 }).map((_, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el; }}
                  className="otp-digit-input" type="text" inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1} value={otp[index] || ''}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  disabled={isLoading} autoFocus={index === 0}
                  aria-label={`Số OTP thứ ${index + 1}`}
                />
              ))}
            </div>

            <div className="otp-actions-row">
              <button
                type="button" className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={requestOtp} disabled={isLoading}
              >
                Gửi lại OTP
              </button>
            </div>

            <button
              type="button" className="btn btn-primary auth-submit-btn"
              style={{ marginTop: '10px' }}
              onClick={confirmOtpAndRegister} disabled={isLoading || otp.length !== 6}
            >
              {isLoading
                ? <><Loader2 size={16} className="spin-icon" /> Đang xác nhận...</>
                : 'Xác Nhận OTP'
              }
            </button>
          </div>
        </div>
      )}

      <footer className="auth-page-footer">
        <LegalFooterLinks />
        <div>© 2026 CardioGuard AI. All rights reserved.</div>
      </footer>
    </div>
  );
};
