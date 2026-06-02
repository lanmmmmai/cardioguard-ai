import React from 'react';
import { useAuth } from '../auth/AuthContext';
import { useBrowserPath } from '../hooks/useBrowserPath';
import { ShieldCheck, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';

export const DoctorPendingVerification: React.FC = () => {
  const { logout, refreshUser } = useAuth();
  const { navigate } = useBrowserPath();

  const handleRefresh = async () => {
    try {
      const freshUser = await refreshUser();
      if (freshUser && freshUser.is_verified) {
        navigate('/doctor/dashboard', true);
      }
    } catch (e) {
      console.error('Failed to refresh user status:', e);
    }
  };

  return (
    <div className="onboarding-page-container flex-center">
      <div className="onboarding-card text-center" style={{ maxWidth: '500px' }}>
        <div className="icon-wrapper bg-teal-soft pulse-animated" style={{ margin: '0 auto 20px' }}>
          <ShieldCheck className="teal-color" size={40} />
        </div>
        
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px' }}>
          Hồ sơ đang chờ phê duyệt
        </h1>
        
        <p className="description" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          Cảm ơn Bác sĩ! Hồ sơ y khoa chuyên môn và giấy tờ tùy thân của bạn đã được tiếp nhận thành công. Ban quản trị hệ thống CardioGuard AI đang xác minh chứng chỉ và thông tin hành nghề của bạn.
        </p>

        <div style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '16px', borderRadius: '12px', marginBottom: '24px', borderLeft: '4px solid var(--color-teal)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Trạng thái tài khoản</span>
          <strong style={{ color: 'var(--color-teal)', fontSize: '1rem', textTransform: 'uppercase' }}>Đang chờ xác thực (Pending)</strong>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Quá trình phê duyệt thường mất từ 12-24 giờ làm việc. Bạn sẽ nhận được thông báo qua email đăng ký ngay sau khi tài khoản được kích hoạt.
        </p>

        <div className="status-actions-grid" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} />
            Làm mới trạng thái
          </button>
          
          <button 
            type="button" 
            className="btn btn-danger-outline" 
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};

export const DoctorVerificationRejected: React.FC = () => {
  const { logout } = useAuth();
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Fetch rejection reason from verification-status
    fetch(`${API_URL}/doctor/verification-status`, {
      headers: { Authorization: `Bearer ${window.sessionStorage.getItem('access_token')}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Failed to fetch verification status');
      })
      .then((data) => {
        if (data && data.verification_note) {
          setNote(data.verification_note);
        }
      })
      .catch((e) => console.warn(e));
  }, []);

  return (
    <div className="onboarding-page-container flex-center">
      <div className="onboarding-card text-center" style={{ maxWidth: '500px' }}>
        <div className="icon-wrapper bg-rose-soft" style={{ margin: '0 auto 20px' }}>
          <ShieldAlert className="rose-color" size={40} />
        </div>
        
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px', color: 'var(--color-critical)' }}>
          Hồ sơ bị từ chối xác thực
        </h1>
        
        <p className="description" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
          Hồ sơ bác sĩ của bạn chưa đáp ứng đủ điều kiện phê duyệt để hành nghề trên hệ thống. 
        </p>

        {note && (
          <div style={{ backgroundColor: 'var(--color-bg-tertiary)', padding: '16px', borderRadius: '12px', marginBottom: '24px', borderLeft: '4px solid var(--color-critical)', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-critical)', display: 'block', fontWeight: 600, marginBottom: '4px' }}>
              Lý do từ chối phê duyệt:
            </span>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {note}
            </p>
          </div>
        )}

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Vui lòng nhấn nút đăng xuất bên dưới, liên hệ với ban quản trị hoặc đăng ký tài khoản khác để làm việc.
        </p>

        <div className="status-actions-grid" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={logout}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
};
