import React, { useRef, useState } from 'react';
import { Activity, ArrowLeft, CheckCircle2, Lock, Mail, ShieldCheck, User, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

interface RegisterProps {
  onRegisterSuccess: () => void;
  onNavigateToLogin: () => void;
}

const fullNamePattern = /^[A-Za-zÀ-ỹ]+(?:[ '\-][A-Za-zÀ-ỹ]+)+$/;
const passwordPattern = /^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

const normalizeName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const Register: React.FC<RegisterProps> = ({ onRegisterSuccess, onNavigateToLogin }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const passwordRules = [
    { label: 'Tối thiểu 8 ký tự', valid: password.length >= 8 },
    { label: 'Có ít nhất 1 chữ hoa', valid: /[A-Z]/.test(password) },
    { label: 'Có chữ và số', valid: /[A-Za-z]/.test(password) && /\d/.test(password) },
    { label: 'Có ký tự đặc biệt', valid: /[^A-Za-z\d]/.test(password) },
  ];

  const validateForm = () => {
    const normalizedName = normalizeName(fullName);

    if (!normalizedName || !email || !password || !confirmPassword) {
      return 'Vui lòng nhập đầy đủ họ tên, Gmail và mật khẩu';
    }

    if (!fullNamePattern.test(normalizedName)) {
      return 'Họ tên phải có ít nhất 2 từ, chỉ gồm chữ cái, khoảng trắng, dấu gạch nối hoặc dấu nháy';
    }

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return 'Vui lòng dùng địa chỉ Gmail để xác minh OTP';
    }

    if (!passwordPattern.test(password)) {
      return 'Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ hoa, có chữ, số và ký tự đặc biệt';
    }

    if (password !== confirmPassword) {
      return 'Mật khẩu nhập lại không khớp';
    }

    return null;
  };

  const requestOtp = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: normalizeName(fullName),
          email: email.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Không gửi được OTP. Vui lòng thử lại');
      }

      setStep('otp');
      setOtp('');
      setSuccess(
        data.dev_otp
          ? `Môi trường dev chưa cấu hình SMTP. Mã OTP tạm: ${data.dev_otp}`
          : `Đã gửi OTP tới ${data.email || email.toLowerCase()}. Vui lòng kiểm tra hộp thư hoặc spam.`
      );
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const nextOtp = otp.padEnd(6, ' ').split('');
    nextOtp[index] = digit || ' ';
    setOtp(nextOtp.join('').replace(/\s/g, ''));

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedOtp = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    setOtp(pastedOtp);
    const focusIndex = Math.min(pastedOtp.length, 5);
    window.setTimeout(() => otpInputRefs.current[focusIndex]?.focus(), 0);
  };

  const confirmOtpAndRegister = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      setError('OTP phải gồm đúng 6 chữ số');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: normalizeName(fullName),
          email: email.toLowerCase(),
          password,
          otp: otp.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Đăng ký thất bại. Email có thể đã tồn tại hoặc OTP không đúng');
      }

      setSuccess('Đăng ký tài khoản bệnh nhân thành công! Đang chuyển sang đăng nhập...');
      setTimeout(onRegisterSuccess, 1800);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestOtp();
  };

  return (
    <div className="auth-container register-auth-shell">
      <div className="panel auth-panel register-panel">
        <div className="register-card-topline" />

        <div className="brand register-brand">
          <div className="brand-icon register-brand-icon">
            <Activity className="beat-animated" size={24} />
          </div>
          <span className="brand-name">CARDIOGUARD AI</span>
        </div>

        <h2 className="auth-title">Đăng Ký Bệnh Nhân</h2>
        <p className="auth-subtitle register-subtitle">Tạo tài khoản Patient bằng Gmail OTP. Admin và Doctor dùng tài khoản được cấp riêng.</p>

        <div className="auth-stepper">
          <div className={`auth-step ${step === 'form' ? 'active' : 'done'}`}>
            <span>1</span>
            <p>Thông tin</p>
          </div>
          <div className="auth-step-line" />
          <div className={`auth-step ${step === 'otp' ? 'active' : ''}`}>
            <span>2</span>
            <p>Xác minh OTP</p>
          </div>
        </div>

        {error && (
          <div className="alert-strip high" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-critical)' }}>Lỗi Đăng Ký</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="alert-strip low" style={{ marginBottom: '1.5rem', textAlign: 'left', borderLeftColor: 'var(--color-bp)' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-bp)' }}>Thông Báo</div>
              <div className="alert-strip-desc">{success}</div>
            </div>
          </div>
        )}

        <div className="auth-helper-card">
          <ShieldCheck size={18} />
          <span>Bấm Đăng Ký để nhận OTP, sau đó nhập mã trong form xác minh hiện lên.</span>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="fullName">Họ và tên bệnh nhân</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="fullName"
                type="text"
                className="form-control"
                placeholder="Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{ paddingLeft: '45px' }}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Gmail nhận OTP</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="benhnhan@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '45px' }}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="Ví dụ: Cardio@123"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '45px' }}
                disabled={isLoading}
                required
              />
            </div>
            <div className="password-rule-list">
              {passwordRules.map((rule) => (
                <div key={rule.label} className={`password-rule ${rule.valid ? 'valid' : ''}`}>
                  <CheckCircle2 size={13} />
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label htmlFor="confirmPassword">Nhập lại mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                id="confirmPassword"
                type="password"
                className="form-control"
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingLeft: '45px' }}
                disabled={isLoading}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: '46px' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="beat-animated" size={18} style={{ marginRight: '6px' }} />
                Đang gửi OTP...
              </>
            ) : (
              <>
                <ShieldCheck size={18} /> Đăng Ký & Gửi OTP
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Admin/Doctor/Patient đã có tài khoản?{' '}
          <span className="auth-link" onClick={onNavigateToLogin}>
            Đăng nhập ngay
          </span>
        </div>
      </div>

      {step === 'otp' && (
        <div className="modal-overlay">
          <div className="modal-content otp-modal-card">
            <button
              type="button"
              className="otp-back-btn"
              onClick={() => {
                setStep('form');
                setOtp('');
                setSuccess(null);
              }}
              disabled={isLoading}
            >
              <ArrowLeft size={16} /> Sửa thông tin
            </button>

            <div className="brand otp-modal-brand">
              <div className="brand-icon otp-shield-icon">
                <ShieldCheck size={22} />
              </div>
            </div>

            <h2 className="auth-title">Nhập Mã OTP</h2>
            <p className="auth-subtitle otp-modal-subtitle">
              Mã xác minh đã được gửi tới
              <span className="otp-email-chip">{email.toLowerCase()}</span>
            </p>

            <div className="otp-digit-grid" aria-label="Nhập mã OTP 6 số">
              {Array.from({ length: 6 }).map((_, index) => (
                <input
                  key={index}
                  ref={(element) => {
                    otpInputRefs.current[index] = element;
                  }}
                  className="otp-digit-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={otp[index] || ''}
                  onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  onPaste={handleOtpPaste}
                  disabled={isLoading}
                  autoFocus={index === 0}
                  aria-label={`Số OTP thứ ${index + 1}`}
                />
              ))}
            </div>

            <div className="otp-actions-row">
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={requestOtp}
                disabled={isLoading}
              >
                Gửi lại OTP
              </button>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', height: '46px', marginTop: '12px' }}
              onClick={confirmOtpAndRegister}
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="beat-animated" size={18} style={{ marginRight: '6px' }} />
                  Đang xác nhận...
                </>
              ) : (
                'Xác Nhận OTP'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
