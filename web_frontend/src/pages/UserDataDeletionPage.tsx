import React from 'react';
import { ArrowLeft, Trash2, Mail, FileText, ShieldCheck, HelpCircle } from 'lucide-react';
import { useLocale } from '../i18n/locale';

interface UserDataDeletionPageProps {
  onBack?: () => void;
}

export const UserDataDeletionPage: React.FC<UserDataDeletionPageProps> = ({ onBack }) => {
  const { locale } = useLocale();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  const isVi = locale === 'vi';

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isVi ? 'Hướng dẫn xóa dữ liệu người dùng' : 'User Data Deletion Guide'}
          </h1>
          <p className="page-subtitle">
            {isVi 
              ? 'Quy trình và các bước yêu cầu xóa tài khoản & thông tin cá nhân liên kết Facebook' 
              : 'Steps to request deletion of your account and Facebook-associated personal data'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px' }}>
        
        {/* Intro Alert Box */}
        <div className="alert-strip medium" style={{ marginBottom: '0.5rem' }}>
          <ShieldCheck size={18} className="alert-strip-icon" />
          <div className="alert-strip-body">
            <div className="alert-strip-title" style={{ fontWeight: 600 }}>
              {isVi ? 'Cam kết bảo mật dữ liệu' : 'Data Privacy Commitment'}
            </div>
            <div className="alert-strip-desc">
              {isVi 
                ? 'CardioGuard AI luôn tuân thủ nghiêm ngặt các chính sách bảo mật thông tin người dùng. Khi bạn yêu cầu xóa dữ liệu, tất cả hồ sơ sinh hoạt, lịch sử chỉ số sinh hiệu và thông tin tài khoản Facebook sẽ được loại bỏ vĩnh viễn khỏi hệ thống.'
                : 'CardioGuard AI strictly complies with user data privacy policies. Upon request, all activity records, vital sign history, and Facebook login credentials will be permanently erased from our system.'}
            </div>
          </div>
        </div>

        {/* Method 1: Self-Service Deletion via App */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
            <Trash2 size={18} />
            {isVi ? 'Cách 1: Yêu cầu xóa trực tiếp trên ứng dụng' : 'Method 1: Request Deletion Directly via App'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {isVi 
              ? 'Người dùng có thể chủ động yêu cầu xóa tài khoản và dữ liệu cá nhân đã đăng nhập bằng Facebook theo các bước sau:'
              : 'Users can proactively request to delete their account and personal data logged in with Facebook by following these steps:'}
          </p>
          <div className="activity-list" style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <span className="patient-status muted" style={{ minWidth: '24px', textAlign: 'center', padding: '2px 6px', borderRadius: '50%' }}>1</span>
              <div>
                <strong>{isVi ? 'Đăng nhập vào tài khoản' : 'Log in to your account'}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isVi ? 'Truy cập vào ứng dụng/website CardioGuard AI và thực hiện đăng nhập.' : 'Access the CardioGuard AI app/website and log in.'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', borderTop: '1px solid var(--glass-border)', paddingTop: '0.8rem' }}>
              <span className="patient-status muted" style={{ minWidth: '24px', textAlign: 'center', padding: '2px 6px', borderRadius: '50%' }}>2</span>
              <div>
                <strong>{isVi ? 'Vào Hồ sơ cá nhân' : 'Go to Personal Profile'}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isVi ? 'Nhấp chọn biểu tượng avatar hoặc mục Hồ sơ cá nhân trên thanh điều hướng.' : 'Click on your avatar or the Profile section in the navigation.'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', borderTop: '1px solid var(--glass-border)', paddingTop: '0.8rem' }}>
              <span className="patient-status muted" style={{ minWidth: '24px', textAlign: 'center', padding: '2px 6px', borderRadius: '50%' }}>3</span>
              <div>
                <strong>{isVi ? 'Chọn Yêu cầu xóa tài khoản / dữ liệu cá nhân' : 'Select Request to delete account / personal data'}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isVi ? 'Xác nhận lại yêu cầu để hệ thống ghi nhận lịch trình xóa tự động.' : 'Confirm your request to initiate the automated deletion scheduler.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Method 2: Contact Support via Email */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-spo2)' }}>
            <Mail size={18} />
            {isVi ? 'Cách 2: Gửi email hỗ trợ yêu cầu xóa dữ liệu' : 'Method 2: Contact Support via Email'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {isVi 
              ? 'Hoặc bạn có thể liên hệ trực tiếp với bộ phận chăm sóc khách hàng của CardioGuard AI để yêu cầu hỗ trợ xóa thủ công:'
              : 'Alternatively, you can contact CardioGuard AI customer support directly to request manual deletion:'}
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{isVi ? 'Gửi email đến:' : 'Send email to:'}</span>
              <strong style={{ color: 'var(--color-spo2)' }}>lanmmmmai@gmail.com</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', fontSize: '0.9rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{isVi ? 'Tiêu đề email:' : 'Email subject:'}</span>
              <strong>{isVi ? 'Yêu cầu xóa dữ liệu CardioGuard AI' : 'CardioGuard AI Data Deletion Request'}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} />
              {isVi ? 'Nội dung cần cung cấp trong email:' : 'Information required in the email content:'}
            </span>
            <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: 1.5 }}>
              <li>
                <strong>{isVi ? 'Họ tên' : 'Full name'}</strong>
              </li>
              <li>
                <strong>{isVi ? 'Email đăng nhập' : 'Login email'}</strong>
              </li>
              <li>
                <strong>{isVi ? 'Nền tảng đăng nhập:' : 'Login platform:'}</strong> Facebook
              </li>
              <li>
                <strong>{isVi ? 'Lý do yêu cầu xóa dữ liệu' : 'Reason for deletion request'}</strong> ({isVi ? 'nếu có' : 'optional'})
              </li>
            </ul>
          </div>
        </section>

        {/* Handling Duration and Actions */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-bp)' }}>
            <HelpCircle size={18} />
            {isVi ? 'Thời gian xử lý' : 'Processing Timeline'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>
            {isVi 
              ? 'CardioGuard AI sẽ tiếp nhận và xử lý yêu cầu xóa dữ liệu của bạn trong vòng từ 7 đến 30 ngày làm việc kể từ thời điểm gửi yêu cầu hợp lệ.'
              : 'CardioGuard AI will receive and process your data deletion request within 7 to 30 working days from the time a valid request is submitted.'}
          </p>
        </section>

        {/* Back navigation button */}
        <div style={{ display: 'flex', marginTop: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={handleBack}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowLeft size={16} />
            {isVi ? 'Quay lại Cài đặt' : 'Back to Settings'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserDataDeletionPage;
