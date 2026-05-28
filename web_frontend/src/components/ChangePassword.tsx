import React, { useState } from 'react';
import { Activity, Lock, Loader2 } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';

interface ChangePasswordProps {
  onNavigateNext: () => void;
}

export const ChangePassword: React.FC<ChangePasswordProps> = ({ onNavigateNext }) => {
  const { accessToken } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      setError('Vui lòng điền đầy đủ thông tin');
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Thay đổi mật khẩu thất bại');
      }

      // Success - navigate next
      onNavigateNext();
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
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
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
                placeholder="Mật khẩu mới (ít nhất 8 ký tự, chữ hoa, số, ký tự đặc biệt)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              'Cập nhật mật khẩu'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
