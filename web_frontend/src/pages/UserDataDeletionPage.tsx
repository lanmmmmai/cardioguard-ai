import React from 'react';
import { ArrowLeft, Trash2, Mail, FileText, ShieldCheck, HelpCircle, Phone } from 'lucide-react';
import { useLocale } from '../i18n/locale';

interface UserDataDeletionPageProps {
  onBack?: () => void;
}

const SUPPORT_PHONE = '0382683221';
const SUPPORT_EMAIL = 'lanmmmmai@gmail.com';

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
    <div className="role-page-stack" style={{ width: '100%', maxWidth: '980px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <div className="page-header" style={{ textAlign: 'center', justifyContent: 'center' }}>
        <div>
          <h1 className="page-title">
            {isVi ? 'Hướng dẫn xóa dữ liệu' : 'User Data Deletion Guide'}
          </h1>
          <p className="page-subtitle">
            {isVi 
              ? 'Quy trình tiếp nhận yêu cầu xóa tài khoản và dữ liệu cá nhân CardioGuard AI'
              : 'How CardioGuard AI handles account and personal data deletion requests'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '860px', margin: '0 auto' }}>
        
        {/* Intro Alert Box */}
        <div className="alert-strip medium" style={{ marginBottom: '0.5rem' }}>
          <ShieldCheck size={18} className="alert-strip-icon" />
          <div className="alert-strip-body">
            <div className="alert-strip-title" style={{ fontWeight: 600 }}>
              {isVi ? 'Cam kết bảo mật dữ liệu' : 'Data Privacy Commitment'}
            </div>
            <div className="alert-strip-desc">
              {isVi 
                ? 'CardioGuard AI luôn tuân thủ nghiêm ngặt các chính sách bảo mật thông tin người dùng. Khi bạn yêu cầu xóa dữ liệu, hệ thống sẽ xử lý theo quy trình tiếp nhận, xác minh danh tính và vô hiệu hóa hoặc xóa các dữ liệu liên quan trong phạm vi áp dụng.'
                : 'CardioGuard AI strictly follows user data privacy policies. When you request deletion, the system handles it through a request, identity verification, and deletion or deactivation of applicable data in scope.'}
            </div>
          </div>
        </div>

        {/* Method 1: In-app request guide */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 className="metric-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
            <Trash2 size={18} />
            {isVi ? 'Cách 1: Gửi yêu cầu từ trong ứng dụng' : 'Method 1: Submit a request from the app'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
            {isVi 
              ? 'Người dùng có thể mở mục Hướng dẫn xóa dữ liệu trong phần Cài đặt để xem và gửi yêu cầu theo các bước sau:'
              : 'Users can open the Data Deletion Guide from Settings to review and submit a request using the following steps:'}
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
                <strong>{isVi ? 'Mở Cài đặt cá nhân' : 'Open Settings'}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isVi ? 'Chọn mục Hướng dẫn xóa dữ liệu hoặc Quy định & Pháp lý trong trang Cài đặt.' : 'Choose the Data Deletion Guide or Legal section in Settings.'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', borderTop: '1px solid var(--glass-border)', paddingTop: '0.8rem' }}>
              <span className="patient-status muted" style={{ minWidth: '24px', textAlign: 'center', padding: '2px 6px', borderRadius: '50%' }}>3</span>
              <div>
                <strong>{isVi ? 'Gửi yêu cầu qua email hỗ trợ' : 'Submit a request via support email'}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {isVi ? 'Cung cấp họ tên, email đăng nhập và nội dung yêu cầu để bộ phận hỗ trợ xử lý.' : 'Provide your full name, login email, and request details so support can process it.'}
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
              ? 'Hoặc bạn có thể liên hệ trực tiếp với bộ phận chăm sóc khách hàng của CardioGuard AI để yêu cầu hỗ trợ xóa dữ liệu thủ công:'
              : 'Alternatively, you can contact CardioGuard AI customer support directly to request manual data deletion:'}
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={14} />
                {isVi ? 'Gửi email đến:' : 'Send email to:'}
              </span>
              <strong style={{ color: 'var(--color-spo2)' }}>{SUPPORT_EMAIL}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', marginBottom: '8px', fontSize: '0.9rem', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Phone size={14} />
                {isVi ? 'Điện thoại hỗ trợ:' : 'Support phone:'}
              </span>
              <strong style={{ color: 'var(--color-primary)' }}>{SUPPORT_PHONE}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', fontSize: '0.9rem', gap: '12px', flexWrap: 'wrap' }}>
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
                <strong>{isVi ? 'Nền tảng đăng nhập:' : 'Login platform:'}</strong> {isVi ? 'Ứng dụng / website CardioGuard AI' : 'CardioGuard AI app / website'}
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
              ? 'CardioGuard AI sẽ tiếp nhận, xác minh và phản hồi yêu cầu của bạn theo quy trình nội bộ. Thời gian xử lý phụ thuộc vào mức độ xác minh và phạm vi dữ liệu cần áp dụng.'
              : 'CardioGuard AI will receive, verify, and respond to your request according to the internal process. Processing time depends on verification requirements and the scope of data affected.'}
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
