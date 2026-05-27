import React, { useState } from 'react';
import { Activity, Mail, Lock, User, Loader2, ShieldCheck } from 'lucide-react';
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
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validateIdentity = () => {
    const normalizedName = normalizeName(fullName);

    if (!normalizedName || !email) {
      return 'Vui lòng nhập họ tên và Gmail để nhận OTP';
    }

    if (!fullNamePattern.test(normalizedName)) {
      return 'Họ tên phải có ít nhất 2 từ, chỉ gồm chữ cái, khoảng trắng, dấu gạch nối hoặc dấu nháy';
    }

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return 'Vui lòng dùng địa chỉ Gmail để xác minh OTP';
    }

    return null;
  };

  const validatePassword = () => {
    if (!password || !confirmPassword) {
      return 'Vui lòng nhập mật khẩu và xác nhận mật khẩu';
    }

    if (!passwordPattern.test(password)) {
      return 'Mật khẩu tối thiểu 8 ký tự, có ít nhất 1 chữ hoa, có chữ, số và ký tự đặc biệt';
    }

    if (password !== confirmPassword) {
      return 'Mật khẩu nhập lại không khớp';
    }

    if (!/^\d{6}$/.test(otp.trim())) {
      return 'OTP phải gồm đúng 6 chữ số';
    }

    return null;
  };

  const requestOtp = async () => {
    const validationError = validateIdentity();
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
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Không gửi được OTP. Vui lòng thử lại');
      }

      setOtpSent(true);
      setSuccess('Đã gửi OTP tới Gmail. Vui lòng kiểm tra hộp thư hoặc spam.');
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const identityError = validateIdentity();
    const passwordError = validatePassword();
    if (identityError || passwordError) {
      setError(identityError || passwordError);
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
          email,
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

  return (
    <div className="auth-container">
      <div className="panel auth-panel">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-icon">
            <Activity className="beat-animated" size={24} />
          </div>
          <span className="brand-name">CARDIOGUARD AI</span>
        </div>

        <h2 className="auth-title">Đăng Ký Bệnh Nhân</h2>
        <p className="auth-subtitle">Đăng ký chỉ dành cho Patient. Admin và Doctor đăng nhập bằng tài khoản được cấp.</p>

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
              <div className="alert-strip-title" style={{ color: 'var(--color-bp)' }}>Thành Công</div>
              <div className="alert-strip-desc">{success}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
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
                required
              />
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', height: '42px', marginBottom: '1rem' }}
            onClick={requestOtp}
            disabled={isLoading}
          >
            {isLoading && !otpSent ? <Loader2 className="beat-animated" size={16} /> : <ShieldCheck size={16} />}
            {otpSent ? 'Gửi lại OTP' : 'Gửi OTP qua Gmail'}
          </button>

          <div className="form-group">
            <label htmlFor="otp">Mã OTP</label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="form-control"
              placeholder="Nhập 6 chữ số"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={!otpSent}
              required
            />
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
                required
              />
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Tối thiểu 8 ký tự, có chữ hoa, chữ thường/chữ cái, số và ký tự đặc biệt.
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
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: '46px' }}
            disabled={isLoading || !otpSent}
          >
            {isLoading && otpSent ? (
              <>
                <Loader2 className="beat-animated" size={18} style={{ marginRight: '6px' }} />
                Đang xác minh...
              </>
            ) : (
              'Xác Minh OTP & Đăng Ký'
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
    </div>
  );
};
