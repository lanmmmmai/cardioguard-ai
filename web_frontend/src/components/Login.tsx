import React, { useState } from 'react';
import { Activity, Mail, Lock, Loader2 } from 'lucide-react';
import { API_URL } from '../config';
import { UserRole } from '../auth/roles';

interface LoginProps {
  role: UserRole;
  onLoginSuccess: (token: string, user: { id: string; full_name: string; email: string; role: string; must_change_password?: boolean }) => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

export const Login: React.FC<LoginProps> = ({ role, onLoginSuccess, onNavigateToRegister, onNavigateToForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Vui lòng điền đầy đủ email và mật khẩu');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, expected_role: role }),
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }

      if (!response.ok) {
        throw new Error(data.detail || 'Email hoặc mật khẩu không chính xác');
      }

      onLoginSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleTitle = () => {
    if (role === 'admin') return 'Đăng Nhập Quản Trị Viên';
    if (role === 'doctor') return 'Đăng Nhập Bác Sĩ';
    return 'Đăng Nhập Bệnh Nhân';
  };

  const getRoleSubtitle = () => {
    if (role === 'admin') return 'Cổng quản trị hệ thống CardioGuard AI dành cho quản trị viên.';
    if (role === 'doctor') return 'Cổng đăng nhập dành cho bác sĩ theo dõi bệnh nhân và dữ liệu sức khỏe.';
    return 'Cổng đăng nhập dành cho bệnh nhân sử dụng hệ thống CardioGuard AI.';
  };

  const getSubmitText = () => {
    if (role === 'admin') return 'Đăng Nhập Quản Trị';
    if (role === 'doctor') return 'Đăng Nhập Bác Sĩ';
    return 'Đăng Nhập';
  };

  return (
    <div className="auth-container">
      <div className="panel auth-panel">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-icon">
            <Activity className="beat-animated" size={24} />
          </div>
          <span className="brand-name">HEART MONITOR</span>
        </div>

        <h2 className="auth-title">{getRoleTitle()}</h2>
        <p className="auth-subtitle">{getRoleSubtitle()}</p>

        {error && (
          <div className="alert-strip high" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title" style={{ color: 'var(--color-critical)' }}>Lỗi Đăng Nhập</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="form-group">
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

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label htmlFor="password">Mật khẩu</label>
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
                id="password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              getSubmitText()
            )}
          </button>
        </form>

        <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {role !== 'admin' && (
            <div>
              {role === 'doctor' ? 'Bác sĩ chưa có tài khoản?' : 'Bệnh nhân chưa có tài khoản?'}{' '}
              <span className="auth-link" onClick={onNavigateToRegister}>
                Đăng ký ngay
              </span>
            </div>
          )}
          <div>
            <span className="auth-link" onClick={onNavigateToForgotPassword}>
              Quên mật khẩu?
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
