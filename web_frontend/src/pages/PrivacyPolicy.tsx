import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useLocale } from '../i18n/locale';

export const PrivacyPolicy: React.FC = () => {
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
            {isVi ? 'Chính sách bảo mật' : 'Privacy Policy'}
          </h1>
          <p className="page-subtitle">
            {isVi ? 'Cập nhật lần cuối: 04 tháng 06, 2026' : 'Last updated: June 04, 2026'}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Intro */}
        <div className="alert-strip success" style={{ marginBottom: '0.5rem' }}>
          <ShieldCheck size={18} className="alert-strip-icon" />
          <div className="alert-strip-body">
            <div className="alert-strip-title" style={{ fontWeight: 600 }}>
              {isVi ? 'Cam kết bảo mật dữ liệu' : 'Data Privacy Commitment'}
            </div>
            <div className="alert-strip-desc">
              {isVi 
                ? 'CardioGuard AI cam kết bảo vệ dữ liệu cá nhân và chỉ số sức khỏe của bạn bằng các kiểm soát bảo mật và phân quyền truy cập phù hợp.'
                : 'CardioGuard AI is committed to protecting your personal details and health metrics through appropriate security controls and access restrictions.'}
            </div>
          </div>
        </div>

        {/* Section 1 */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 className="metric-title" style={{ color: 'var(--color-primary)' }}>
            {isVi ? '1. Dữ liệu chúng tôi thu thập' : '1. Data We Collect'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {isVi 
              ? 'Chúng tôi thu thập các thông tin sau để duy trì và cải thiện dịch vụ chăm sóc sức khỏe:'
              : 'We collect the following details to maintain and improve our health monitoring services:'}
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li><strong>{isVi ? 'Thông tin cá nhân:' : 'Personal Info:'}</strong> {isVi ? 'Họ tên, email, số điện thoại.' : 'Full name, email, phone number.'}</li>
            <li><strong>{isVi ? 'Hồ sơ người dùng:' : 'User Profile:'}</strong> {isVi ? 'Hồ sơ bệnh nhân (tiền sử bệnh, dị ứng, liên hệ khẩn cấp) hoặc hồ sơ bác sĩ (chuyên khoa, nơi công tác).' : 'Patient profile (history, allergies, emergency contact) or doctor profile (specialty, workplace).'}</li>
            <li><strong>{isVi ? 'Dữ liệu sức khỏe IoT:' : 'IoT Health Vitals:'}</strong> {isVi ? 'Nhịp tim, SpO2, huyết áp và ECG truyền realtime từ thiết bị cảm biến đeo tay.' : 'Real-time heart rate, SpO2, blood pressure, and ECG from wrist sensors.'}</li>
            <li><strong>{isVi ? 'Cảnh báo & SOS:' : 'Alerts & SOS:'}</strong> {isVi ? 'Lịch sử cảnh báo lâm sàng và yêu cầu hỗ trợ khẩn cấp.' : 'Clinical alerts history and emergency support requests.'}</li>
            <li><strong>{isVi ? 'Trao đổi tư vấn:' : 'Consultation Logs:'}</strong> {isVi ? 'Tin nhắn trao đổi trực tiếp giữa bệnh nhân và bác sĩ.' : 'Direct messages between patient and doctor.'}</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 className="metric-title" style={{ color: 'var(--color-spo2)' }}>
            {isVi ? '2. Mục đích sử dụng dữ liệu' : '2. Purpose of Data Processing'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {isVi 
              ? 'Dữ liệu của bạn được sử dụng cho các mục đích vận hành và hỗ trợ chăm sóc sức khỏe:'
              : 'Your data is used for healthcare operations and care support:'}
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>{isVi ? 'Xác thực tài khoản và phân quyền truy cập an toàn (Admin / Bác sĩ / Bệnh nhân).' : 'Account verification and role-based secure access (Admin / Doctor / Patient).'}</li>
            <li>{isVi ? 'Cảnh báo tức thời và gửi tín hiệu SOS khẩn cấp đến bác sĩ khi các chỉ số vượt ngưỡng an toàn.' : 'Instant warning triggers and emergency SOS routing to doctor when vitals cross thresholds.'}</li>
            <li>{isVi ? 'Quản lý lịch hẹn tái khám và nhắc lịch khám tự động.' : 'Follow-up appointment management and automated notifications.'}</li>
            <li>{isVi ? 'Hỗ trợ bác sĩ theo dõi sức khỏe và xem xét lâm sàng từ xa.' : 'Support doctors with remote health monitoring and clinical review.'}</li>
          </ul>
        </section>

        {/* Section 3 */}
        <section className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          <h3 className="metric-title" style={{ color: 'var(--color-safe)' }}>
            {isVi ? '3. Quyền lợi của bạn' : '3. Your Rights'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {isVi 
              ? 'Người dùng có đầy đủ các quyền đối với dữ liệu của mình theo quy định pháp lý:'
              : 'Users possess full rights over their personal data under privacy regulations:'}
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <li>{isVi ? 'Quyền xem và cập nhật hồ sơ cá nhân của bạn trên ứng dụng.' : 'Right to access and edit personal profiles on the app.'}</li>
            <li>{isVi ? 'Quyền yêu cầu đính chính dữ liệu sức khỏe hoặc bệnh án bị sai lệch.' : 'Right to correct health or medical record discrepancies.'}</li>
            <li>{isVi ? 'Quyền yêu cầu xóa tài khoản và dữ liệu cá nhân theo quy trình tiếp nhận hiện hành của CardioGuard AI.' : 'Right to request deletion of your account and personal data through CardioGuard AI’s current request process.'}</li>
          </ul>
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

export default PrivacyPolicy;
