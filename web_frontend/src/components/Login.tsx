import React, { useState } from 'react';
import { Activity, Mail, Lock, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

interface LoginProps {
  onLoginSuccess: (token: string, user: { id: string; full_name: string; email: string; role: string }) => void;
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onNavigateToRegister }) => {
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
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

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

  return (
    <div className="auth-container">
      <div className="panel auth-panel">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="brand-icon">
            <Activity className="beat-animated" size={24} />
          </div>
          <span className="brand-name">HEART MONITOR</span>
        </div>

        <h2 className="auth-title">Đăng Nhập Hệ Thống</h2>
        <p className="auth-subtitle">Dành cho Admin, Doctor và Patient trong hệ thống CardioGuard AI</p>

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
                placeholder="admin/doctor/patient@email.com"
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
              'Đăng Nhập'
            )}
          </button>
        </form>

        <div className="auth-footer">
          Bệnh nhân chưa có tài khoản?{' '}
          <span className="auth-link" onClick={onNavigateToRegister}>
            Đăng ký ngay
          </span>
        </div>
      </div>
    </div>
  );
};
