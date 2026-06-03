/**
 * @purpose Biểu mẫu đổi mật khẩu bắt buộc. Hiển thị sau lần đăng nhập đầu tiên hoặc
 *          khi quản trị viên yêu cầu đặt lại mật khẩu. Xác thực mật khẩu mới theo
 *          chính sách mật khẩu mạnh trước khi gửi lên máy chủ.
 * @workflow  1. Người dùng nhập mật khẩu cũ + mới + xác nhận → 2. Xác thực phía máy
 *            khách (khớp, độ mạnh, không trùng mật khẩu cũ) → 3. POST đến
 *            /auth/change-password → 4. Khi thành công, gọi onNavigateNext sau một
 *            hiệu ứng hoạt hình thành công ngắn.
 * @relationships
 *   - AuthContext để lấy mã truy cập
 *   - passwordPolicy utility (isStrongPassword, passwordPolicyMessage)
 *   - App.tsx (khối route cho /change-password)
 */
import React, { useState, useRef, useEffect } from 'react';
import { Activity, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';
import type { UserRole } from '../auth/roles';
import { isStrongPassword, passwordPolicyMessage } from '../utils/passwordPolicy';

interface ChangePasswordProps {
  onNavigateNext: (nextRole?: UserRole) => void;
}

/**
 * Biểu mẫu đổi mật khẩu với xác thực phía máy khách và gửi lên API.
 */
export const ChangePassword: React.FC<ChangePasswordProps> = ({ onNavigateNext }) => {
  const { accessToken, login, refreshUser, role } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới và xác nhận mật khẩu không khớp');
      return;
    }
    if (newPassword === oldPassword) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại');
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setError(passwordPolicyMessage);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }

      if (!response.ok) {
        throw new Error(data.detail || 'Thay đổi mật khẩu thất bại');
      }

      let nextRole = role || undefined;
      if (data.access_token && data.user) {
        const updatedUser = login(data.access_token, data.user);
        nextRole = updatedUser.role;
      } else {
        const refreshedUser = await refreshUser();
        nextRole = refreshedUser?.role || nextRole;
      }

      setSuccess(true);
      timerRef.current = setTimeout(() => {
        onNavigateNext(nextRole);
      }, 900);
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

        <h2 className="auth-title">Đổi Mật Khẩu</h2>
        <p className="auth-subtitle">Bạn cần đổi mật khẩu để tiếp tục sử dụng hệ thống một cách an toàn.</p>

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
            <div className="alert-strip-body" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--color-safe)', flexShrink: 0 }} />
              <div>
                <div className="alert-strip-title" style={{ color: 'var(--color-safe)' }}>Thành công!</div>
                <div className="alert-strip-desc">Mật khẩu đã được cập nhật. Đang chuyển hướng...</div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div className="form-group">
            <label htmlFor="oldPassword">Mật khẩu hiện tại (hoặc mật khẩu tạm thời)</label>
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
                id="oldPassword"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                style={{ paddingLeft: '45px' }}
                required
                disabled={success}
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
                disabled={success}
              />
            </div>
            <small style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Phải có ít nhất 8 ký tự, 1 chữ hoa, 1 số và 1 ký tự đặc biệt.
            </small>
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
                disabled={success}
              />
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <small style={{ color: 'var(--color-critical)', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Mật khẩu không khớp
              </small>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', height: '46px' }}
            disabled={isLoading || success || !isStrongPassword(newPassword) || !!(confirmPassword && confirmPassword !== newPassword)}
          >
            {isLoading ? (
              <>
                <Loader2 className="beat-animated" size={18} style={{ marginRight: '6px' }} />
                Đang xử lý...
              </>
            ) : (
              'Cập nhật mật khẩu'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
