import React, { useState } from 'react';
import { Activity, Mail, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { API_URL } from '../config';
import { UserRole } from '../auth/roles';

interface ForgotPasswordProps {
  role: UserRole;
  onNavigateToLogin: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ role, onNavigateToLogin }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Vui lòng nhập email');
      return;
    }

    setError(null);
    setSuccess(null);
    setResetComplete(false);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }
      if (!response.ok) {
        throw new Error(data.detail || 'Không thể yêu cầu OTP');
      }

      setSuccess(
        data.email_sent === false
          ? 'Nếu email tồn tại, mã OTP đã được tạo. Môi trường dev chưa cấu hình gửi email, vui lòng xem log backend.'
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

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }
      if (!response.ok) {
        throw new Error(data.detail || 'Xác minh OTP thất bại');
      }

      setSuccess('Mật khẩu tạm thời đã được gửi đến email của bạn. Vui lòng kiểm tra hộp thư để đăng nhập.');
      setResetComplete(true);
      setOtp('');
      setTimeout(() => {
        onNavigateToLogin();
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleTitle = () => {
    if (role === 'admin') return 'Quên Mật Khẩu Admin';
    if (role === 'doctor') return 'Quên Mật Khẩu Bác Sĩ';
    return 'Quên Mật Khẩu';
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

        <h2 className="auth-title">{getRoleTitle()}</h2>
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
                  placeholder={role === 'admin' ? 'admin@email.com' : (role === 'doctor' ? 'doctor@email.com' : 'patient@email.com')}
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
                  placeholder="Nhập mã OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  style={{ paddingLeft: '45px', letterSpacing: '2px', fontFamily: 'monospace' }}
                  maxLength={6}
                  disabled={isLoading || resetComplete}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', justifyContent: 'center', height: '46px' }}
              disabled={isLoading || resetComplete || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="beat-animated" size={18} style={{ marginRight: '6px' }} />
                  Đang xử lý...
                </>
              ) : resetComplete ? (
                'Đã xác nhận OTP'
              ) : (
                'Xác nhận OTP'
              )}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: '100%', justifyContent: 'center', height: '46px' }}
                onClick={() => {
                  if (resetComplete) {
                    onNavigateToLogin();
                  } else {
                    setStep(1);
                  }
                }}
              >
                {resetComplete ? 'Quay lại đăng nhập' : 'Nhập lại email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
