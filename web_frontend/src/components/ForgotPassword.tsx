import React, { useState } from 'react';
import { Activity, Mail, Loader2, ArrowLeft, KeyRound, Lock } from 'lucide-react';
import { API_URL } from '../config';

interface ForgotPasswordProps {
  onNavigateToLogin: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigateToLogin }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const passwordPattern = /^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Vui lòng nhập email');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Không thể yêu cầu OTP');
      }

      setSuccess(
        data.dev_otp
          ? `Môi trường dev chưa cấu hình SMTP. Mã OTP tạm: ${data.dev_otp}`
          : 'Mã OTP đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư.'
      );
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError('Vui lòng nhập mã OTP');
      return;
    }
    if (!passwordPattern.test(newPassword)) {
      setError('Mật khẩu mới cần ít nhất 8 ký tự, có chữ hoa, số và ký tự đặc biệt');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Xác minh OTP thất bại');
      }

      setSuccess('Mật khẩu của bạn đã được đặt lại thành công. Đang chuyển sang đăng nhập...');
      setStep(1); // Reset form logically
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onNavigateToLogin();
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="panel auth-panel">
        <button type="button" className="auth-back-btn" onClick={onNavigateToLogin}>
          <ArrowLeft size={16} /> Quay lại đăng nhập
        </button>

        <div className="brand" style={{ justifyContent: 'center', marginBottom: '1.5rem', marginTop: '1rem' }}>
          <div className="brand-icon">
            <Activity className="beat-animated" size={24} />
          </div>
          <span className="brand-name">HEART MONITOR</span>
        </div>

        <h2 className="auth-title">Quên Mật Khẩu</h2>
        <p className="auth-subtitle">
          {step === 1 
            ? 'Nhập email của bạn để nhận mã xác nhận đặt lại mật khẩu.' 
            : 'Nhập mã OTP gồm 6 chữ số đã được gửi đến email của bạn.'}
        </p>

        {error && (
          <div className="alert-strip high" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-critical)' }}>Lỗi</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="alert-strip low" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-safe)' }}>Thành công</div>
              <div className="alert-strip-desc">{success}</div>
            </div>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} style={{ textAlign: 'left' }}>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="email">Email</label>
              <div style={{ position: 'relative' }}>
                <Mail 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)' 
                  }} 
                />
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  placeholder="admin/doctor/patient@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: '45px' }}
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
                  Đang xử lý...
                </>
              ) : (
                'Gửi mã xác nhận'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ textAlign: 'left' }}>
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="otp">Mã OTP (6 chữ số)</label>
              <div style={{ position: 'relative' }}>
                <KeyRound 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    left: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)' 
                  }} 
                />
                <input
                  id="otp"
                  type="text"
                  className="form-control"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ paddingLeft: '45px', letterSpacing: '2px', fontFamily: 'monospace' }}
                  maxLength={6}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)'
                  }}
                />
                <input
                  id="newPassword"
                  type="password"
                  className="form-control"
                  placeholder="Tối thiểu 8 ký tự, chữ hoa, số, ký tự đặc biệt"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingLeft: '45px' }}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={18}
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: confirmPassword && confirmPassword !== newPassword ? 'var(--color-critical)' : 'var(--text-muted)'
                  }}
                />
                <input
                  id="confirmPassword"
                  type="password"
                  className="form-control"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    paddingLeft: '45px',
                    borderColor: confirmPassword && confirmPassword !== newPassword ? 'var(--color-critical)' : undefined
                  }}
                  required
                />
              </div>
              <small style={{ color: confirmPassword && confirmPassword !== newPassword ? 'var(--color-critical)' : 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Mật khẩu phải có ít nhất 8 ký tự, 1 chữ hoa, 1 số và 1 ký tự đặc biệt.
              </small>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', height: '46px' }}
              disabled={isLoading || otp.length !== 6 || !newPassword || newPassword !== confirmPassword}
            >
              {isLoading ? (
                <>
                  <Loader2 className="beat-animated" size={18} style={{ marginRight: '6px' }} />
                  Đang xử lý...
                </>
              ) : (
                'Xác nhận OTP'
              )}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', height: '46px' }}
                onClick={() => setStep(1)}
              >
                Nhập lại email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
