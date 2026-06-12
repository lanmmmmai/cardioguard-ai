import React from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useLocale } from '../i18n/locale';

export const TermsOfService: React.FC = () => {
  const { locale } = useLocale();

  const handleBack = () => {
    window.history.back();
  };

  const isVi = locale === 'vi';

  return (
    <div className="role-page-stack" style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isVi ? 'Điều khoản dịch vụ' : 'Terms of Service'}
          </h1>
          <p className="page-subtitle">
            {isVi ? 'Cập nhật lần cuối: 04 tháng 06, 2026' : 'Last updated: June 04, 2026'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Medical Dislaimer Warning Box */}
        <div className="alert-strip danger" style={{ marginBottom: '0.5rem' }}>
          <AlertTriangle size={18} className="alert-strip-icon" />
          <div className="alert-strip-body">
            <div className="alert-strip-title" style={{ fontWeight: 700 }}>
              {isVi ? 'LƯU Ý Y TẾ QUAN TRỌNG' : 'IMPORTANT MEDICAL DISCLAIMER'}
            </div>
            <div className="alert-strip-desc">
              {isVi 
                ? 'CardioGuard AI chỉ hỗ trợ theo dõi và đưa ra cảnh báo sức khỏe tim mạch mang tính tham khảo. Ứng dụng này không thay thế cho chẩn đoán, chỉ định điều trị hoặc quyết định lâm sàng của bác sĩ phụ trách.'
                : 'CardioGuard AI only supports cardiovascular health monitoring and reference alerts. This application does not replace diagnoses, treatment instructions, or clinical decisions made by your healthcare provider.'}
            </div>
          </div>
        </div>

        {/* Section 1 */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 className="metric-title" style={{ color: 'var(--color-primary)' }}>
            {isVi ? '1. Điều kiện sử dụng' : '1. Conditions of Use'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {isVi 
              ? 'Bằng cách đăng ký tài khoản và sử dụng nền tảng của chúng tôi, bạn cam kết cung cấp thông tin cá nhân và thông tin y tế chính xác để hệ thống hoạt động đúng mục đích.'
              : 'By registering and using our platform, you commit to providing accurate personal and medical details so the system can operate as intended.'}
          </p>
        </section>

        {/* Section 2 */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 className="metric-title" style={{ color: 'var(--color-spo2)' }}>
            {isVi ? '2. Phân loại tài khoản' : '2. Account Classification'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {isVi 
              ? 'Hệ thống CardioGuard AI phân quyền người dùng cụ thể cho 3 nhóm đối tượng:'
              : 'The CardioGuard AI system grants specific access rights based on 3 user groups:'}
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li><strong>{isVi ? 'Bệnh nhân:' : 'Patients:'}</strong> {isVi ? 'Theo dõi chỉ số sinh hiệu, gửi SOS cứu hộ, xem đơn thuốc và chat với bác sĩ.' : 'Monitor vital signs, send SOS alerts, view prescriptions, and chat with doctors.'}</li>
            <li><strong>{isVi ? 'Bác sĩ:' : 'Doctors:'}</strong> {isVi ? 'Giám sát chỉ số bệnh nhân, lập bệnh án điện tử, ký xác nhận y khoa và tư vấn lâm sàng.' : 'Monitor assigned patients, write clinical records, sign medical charts, and consult patients.'}</li>
            <li><strong>{isVi ? 'Quản trị viên:' : 'Administrators:'}</strong> {isVi ? 'Quản lý tài khoản, cấu hình ngưỡng cảnh báo hệ thống, phê duyệt xác thực.' : 'User administration, system settings management, and credential verification.'}</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 className="metric-title" style={{ color: 'var(--color-safe)' }}>
            {isVi ? '3. Quy định phê duyệt tài khoản bác sĩ' : '3. Doctor Verification Rules'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {isVi 
              ? 'Tất cả tài khoản đăng ký dưới vai trò Bác sĩ phải được Admin xác thực và duyệt chứng chỉ y khoa trước khi được phép hoạt động lâm sàng chính thức trên ứng dụng.'
              : 'All accounts registered as Doctors must be verified by the admin based on clinical credentials prior to conducting active telemedicine activities.'}
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
            {isVi ? 'Quay lại' : 'Back'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default TermsOfService;
