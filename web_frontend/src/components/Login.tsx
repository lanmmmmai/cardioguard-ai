/**
 * @purpose Biểu mẫu đăng nhập người dùng. Thu thập email và mật khẩu, xác thực
 *          với backend và ủy quyền kết quả cho callback cha xử lý lưu phiên
 *          và điều hướng.
 * @workflow  1. Người dùng gửi email + mật khẩu → 2. POST đến /auth/login →
 *            3. Khi thành công, gọi onLoginSuccess(token, user) → component cha
 *            (App.tsx) lưu phiên và điều hướng đến route mặc định của vai trò →
 *            4. Khi thất bại, hiển thị thông báo lỗi.
 * @relationships
 *   - App.tsx (callback handleLoginSuccess)
 *   - Hằng số cấu hình API_URL
 */
import React, { useState } from 'react';
import { Activity, Mail, Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { API_URL, GOOGLE_CLIENT_ID, FACEBOOK_APP_ID } from '../config';
import { UserRole } from '../auth/roles';
import { LegalFooterLinks } from './LegalFooterLinks';
import { SocialLoginIcons } from './SocialLoginIcons';
import { readJsonResponse } from '../utils/response';
import { exchangeGoogleIdToken } from '../lib/googleAuth';
import { exchangeFacebookToken } from '../lib/facebookAuth';

interface LoginProps {
  role: UserRole;
  onLoginSuccess: (token: string, user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    must_change_password?: boolean;
    profile_completed?: boolean;
    is_verified?: boolean;
    status?: string;
  }) => void;
  onNavigateToRegister: () => void;
  onNavigateToForgotPassword: () => void;
}

export const Login: React.FC<LoginProps> = ({ role, onLoginSuccess, onNavigateToRegister, onNavigateToForgotPassword }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const showGoogleLogin = role !== 'admin' && Boolean(GOOGLE_CLIENT_ID);
  const showFacebookLogin = role !== 'admin';

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, expected_role: role }),
      });
      const data = await readJsonResponse<{
        detail?: string;
        access_token?: string;
        user?: {
          id: string; full_name: string; email: string; role: string;
          must_change_password?: boolean; profile_completed?: boolean;
          is_verified?: boolean; status?: string;
        };
      }>(response);
      if (!response.ok) throw new Error(data.detail || 'Email hoặc mật khẩu không chính xác');
      if (!data.access_token || !data.user) throw new Error('Phản hồi đăng nhập không đầy đủ từ server');
      onLoginSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleCredential = async (idToken: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await exchangeGoogleIdToken(idToken, role);
      onLoginSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập Google thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookToken = async (accessToken: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await exchangeFacebookToken(accessToken, role);
      onLoginSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập Facebook thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleTitle = () => {
    if (role === 'admin') return 'Đăng Nhập Quản Trị';
    if (role === 'doctor') return 'Đăng Nhập Bác Sĩ';
    return 'Đăng Nhập';
  };

  const getRoleSubtitle = () => {
    if (role === 'admin') return 'Cổng quản trị hệ thống CardioGuard AI.';
    if (role === 'doctor') return 'Theo dõi bệnh nhân và dữ liệu sức khỏe tim mạch.';
    return 'Theo dõi sức khỏe tim mạch của bạn mọi lúc mọi nơi.';
  };

  return (
    <div className="auth-shell">
      <div className="auth-shell-body">
        <div className="panel auth-panel">

          {/* Brand */}
          <div className="auth-brand">
            <div className="brand-icon">
              <Activity className="beat-animated" size={22} />
            </div>
            <span className="brand-name">CardioGuard AI</span>
          </div>

          {/* Header */}
          <h2 className="auth-title">{getRoleTitle()}</h2>
          <p className="auth-subtitle">{getRoleSubtitle()}</p>

          {/* Error */}
          {error && (
            <div className="auth-error-strip">
              <span className="auth-error-label">Lỗi:</span> {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="login-email">Email</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="form-control input-with-icon"
                  placeholder={role === 'admin' ? 'admin@email.com' : role === 'doctor' ? 'doctor@email.com' : 'patient@email.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="auth-label-row">
                <label htmlFor="login-password">Mật khẩu</label>
                <span className="auth-link auth-link-sm" onClick={onNavigateToForgotPassword}>
                  Quên mật khẩu?
                </span>
              </div>
              <div className="input-icon-wrap">
                <Lock size={16} className="input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control input-with-icon input-with-icon-right"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="input-icon-btn-right"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading
                ? <><Loader2 size={16} className="spin-icon" /> Đang xử lý...</>
                : getRoleTitle()
              }
            </button>
          </form>

          {/* Social login */}
          <SocialLoginIcons
            showGoogle={showGoogleLogin}
            showFacebook={showFacebookLogin}
            googleClientId={GOOGLE_CLIENT_ID}
            facebookAppId={FACEBOOK_APP_ID}
            facebookRole={role !== 'admin' ? role : undefined}
            disabled={isLoading}
            label="Đăng nhập bằng phương thức khác"
            onGoogleCredential={handleGoogleCredential}
            onFacebookToken={handleFacebookToken}
          />

          {/* Footer links */}
          {role !== 'admin' && (
            <div className="auth-footer">
              {role === 'doctor' ? 'Bác sĩ chưa có tài khoản?' : 'Chưa có tài khoản?'}{' '}
              <span className="auth-link" onClick={onNavigateToRegister}>Đăng ký ngay</span>
            </div>
          )}
        </div>
      </div>

      <footer className="auth-page-footer">
        <LegalFooterLinks />
        <div>© 2026 CardioGuard AI. All rights reserved.</div>
      </footer>
    </div>
  );
};
