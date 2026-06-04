import React from 'react';
import { Activity, ShieldCheck, FileText, Trash2, ArrowLeft, Sun, Moon } from 'lucide-react';

interface PublicPoliciesProps {
  path: string;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  navigate: (path: string, replace?: boolean) => void;
}

export const PublicPolicies: React.FC<PublicPoliciesProps> = ({ path, theme, onToggleTheme, navigate }) => {
  const isDark = theme === 'dark';

  const renderContent = () => {
    switch (path) {
      case '/privacy':
        return (
          <>
            <div className="policy-header-icon" style={{ color: 'var(--color-bp)' }}>
              <ShieldCheck size={48} />
            </div>
            <h1 className="policy-title">Chính Sách Bảo Mật</h1>
            <p className="policy-subtitle">Cập nhật lần cuối: 4 tháng 6, 2026</p>
            
            <div className="policy-section">
              <h2>1. Thu thập dữ liệu</h2>
              <p>
                CardioGuard AI thu thập thông tin cá nhân và dữ liệu y tế của bạn nhằm phục vụ mục đích giám sát sức khỏe tim mạch theo thời gian thực. Các dữ liệu này bao gồm:
              </p>
              <ul>
                <li><strong>Thông tin định danh:</strong> Họ và tên, địa chỉ email, số điện thoại.</li>
                <li><strong>Thông tin nhân khẩu học:</strong> Tuổi, giới tính, địa chỉ liên hệ.</li>
                <li><strong>Dữ liệu đo đạc (Telemetry):</strong> Chỉ số nhịp tim (Heart Rate), nồng độ oxy trong máu (SpO2), huyết áp (Blood Pressure) và tín hiệu điện tâm đồ (ECG).</li>
              </ul>
            </div>

            <div className="policy-section">
              <h2>2. Cách thức sử dụng thông tin</h2>
              <p>
                Chúng tôi sử dụng dữ liệu thu thập được để:
              </p>
              <ul>
                <li>Hiển thị trực quan các chỉ số sức khỏe của bạn trên ứng dụng di động và cổng web.</li>
                <li>Phân tích tự động bằng trí tuệ nhân tạo (AI) để gửi cảnh báo sớm khi phát hiện bất thường lâm sàng.</li>
                <li>Hỗ trợ bác sĩ điều trị của bạn theo dõi và đưa ra phác đồ y khoa chính xác.</li>
              </ul>
            </div>

            <div className="policy-section">
              <h2>3. Chia sẻ dữ liệu</h2>
              <p>
                Dữ liệu sức khỏe và thông tin cá nhân của bạn được bảo mật tuyệt đối. Chúng tôi <strong>không bao giờ</strong> bán hoặc chia sẻ dữ liệu cho bên thứ ba vì mục đích thương mại. Thông tin chỉ được hiển thị cho:
              </p>
              <ul>
                <li>Chính bản thân bạn thông qua tài khoản cá nhân.</li>
                <li>Bác sĩ phụ trách trực tiếp được bạn hoặc quản trị viên bệnh viện phân công.</li>
                <li>Quản trị viên hệ thống để vận hành kỹ thuật và bảo mật nền tảng.</li>
              </ul>
            </div>

            <div className="policy-section">
              <h2>4. Bảo mật dữ liệu</h2>
              <p>
                Mọi đường truyền dữ liệu (từ cảm biến phần cứng đến server, và từ server đến app/web) đều được mã hóa bằng chuẩn bảo mật SSL/TLS. Cơ sở dữ liệu y tế được lưu trữ an toàn và kiểm soát quyền truy cập nghiêm ngặt.
              </p>
            </div>
          </>
        );

      case '/terms':
        return (
          <>
            <div className="policy-header-icon" style={{ color: 'var(--color-normal)' }}>
              <FileText size={48} />
            </div>
            <h1 className="policy-title">Điều Khoản Dịch Vụ</h1>
            <p className="policy-subtitle">Cập nhật lần cuối: 4 tháng 6, 2026</p>

            <div className="policy-section">
              <h2>1. Chấp thuận điều khoản</h2>
              <p>
                Bằng việc đăng ký tài khoản và sử dụng hệ thống CardioGuard AI (bao gồm thiết bị đeo phần cứng, ứng dụng di động và trang web), bạn đồng ý tuân thủ các điều khoản dịch vụ này. Nếu bạn không đồng ý, vui lòng ngừng sử dụng dịch vụ ngay lập tức.
              </p>
            </div>

            <div className="policy-section">
              <h2>2. Tuyên bố từ chối trách nhiệm y tế</h2>
              <div className="alert-strip high" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <div className="alert-strip-body">
                  <div className="alert-strip-title" style={{ color: 'var(--color-critical)' }}>LƯU Ý QUAN TRỌNG</div>
                  <div className="alert-strip-desc">
                    CardioGuard AI là một hệ thống hỗ trợ giám sát chỉ số tim mạch và đưa ra cảnh báo tham khảo. Nền tảng này <strong>KHÔNG</strong> thay thế cho các dịch vụ y tế khẩn cấp (như cấp cứu 115) hoặc các chẩn đoán trực tiếp của bác sĩ chuyên khoa tại cơ sở y tế. Trong trường hợp khẩn cấp, hãy liên hệ ngay cơ sở y tế gần nhất.
                  </div>
                </div>
              </div>
            </div>

            <div className="policy-section">
              <h2>3. Trách nhiệm tài khoản</h2>
              <p>
                Bạn có trách nhiệm bảo mật thông tin đăng nhập cá nhân (email, mật khẩu). Mọi hoạt động được thực hiện dưới tài khoản của bạn sẽ thuộc trách nhiệm cá nhân của bạn. Bạn cam kết cung cấp thông tin liên hệ chính xác để bác sĩ có thể liên hệ kịp thời trong tình huống cảnh báo khẩn cấp.
              </p>
            </div>

            <div className="policy-section">
              <h2>4. Sở hữu trí tuệ</h2>
              <p>
                Nền tảng, giao diện, phần mềm AI và các công cụ trực quan hóa dữ liệu thuộc quyền sở hữu trí tuệ độc quyền của CardioGuard AI. Bạn không được sao chép, dịch ngược hoặc sử dụng trái phép mã nguồn của dự án.
              </p>
            </div>
          </>
        );

      case '/data-deletion':
        return (
          <>
            <div className="policy-header-icon" style={{ color: 'var(--color-critical)' }}>
              <Trash2 size={48} />
            </div>
            <h1 className="policy-title">Yêu Cầu Xóa Dữ Liệu</h1>
            <p className="policy-subtitle">Hướng dẫn xóa tài khoản & thông tin liên kết</p>

            <div className="policy-section">
              <h2>Quy trình xóa dữ liệu cho người dùng</h2>
              <p>
                Để tuân thủ chính sách của Meta và bảo vệ quyền riêng tư cá nhân của bạn, chúng tôi cung cấp các tùy chọn để bạn có thể xóa toàn bộ tài khoản và các dữ liệu liên quan khỏi hệ thống CardioGuard AI.
              </p>
            </div>

            <div className="policy-section">
              <h2>Cách 1: Yêu cầu qua email hỗ trợ (Khuyên dùng)</h2>
              <p>
                Bạn có thể gửi email yêu cầu xóa dữ liệu đến bộ phận hỗ trợ của chúng tôi:
              </p>
              <div className="policy-card-info" style={{ padding: '1.2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', margin: '1rem 0' }}>
                <p style={{ margin: '0 0 8px 0' }}>• <strong>Địa chỉ email nhận yêu cầu:</strong> <a href="mailto:support@cardioguard.ai" style={{ color: 'var(--color-bp)' }}>support@cardioguard.ai</a></p>
                <p style={{ margin: '0 0 8px 0' }}>• <strong>Tiêu đề email:</strong> Yêu cầu xóa dữ liệu tài khoản CardioGuard AI</p>
                <p style={{ margin: '0' }}>• <strong>Nội dung:</strong> Cung cấp Họ và tên, Email đăng ký tài khoản cần xóa và vai trò (Bệnh nhân/Bác sĩ).</p>
              </div>
              <p>
                Sau khi nhận được email, quản trị viên hệ thống của chúng tôi sẽ tiến hành xác minh và thực hiện xóa vĩnh viễn tài khoản của bạn trong vòng <strong>48 giờ làm việc</strong>. Một email xác nhận kết quả sẽ được gửi lại cho bạn sau khi tiến trình hoàn tất.
              </p>
            </div>

            <div className="policy-section">
              <h2>Cách 2: Yêu cầu trực tiếp từ ứng dụng web</h2>
              <p>
                Nếu bạn đã đăng nhập tài khoản bệnh nhân, bạn có thể thực hiện theo các bước sau:
              </p>
              <ol>
                <li>Truy cập vào mục <strong>Cá nhân / Cài đặt</strong> trên ứng dụng.</li>
                <li>Tìm kiếm nút <strong>"Yêu cầu xóa tài khoản"</strong> ở cuối trang.</li>
                <li>Xác nhận bằng mật khẩu của bạn để hoàn tất việc gửi yêu cầu tự động.</li>
              </ol>
            </div>

            <div className="policy-section">
              <h2>Dữ liệu nào sẽ bị xóa?</h2>
              <p>
                Khi quá trình xóa tài khoản hoàn tất, các dữ liệu sau của bạn sẽ bị <strong>xóa vĩnh viễn và không thể khôi phục</strong>:
              </p>
              <ul>
                <li>Thông tin tài khoản đăng nhập (Họ tên, Email, Mật khẩu băm, SĐT, Địa chỉ).</li>
                <li>Toàn bộ lịch sử đo đạc nhịp tim, SpO2, huyết áp và điện tâm đồ (ECG) đã lưu.</li>
                <li>Lịch sử đơn thuốc, hồ sơ bệnh án và lịch sử hội thoại tư vấn với Bác sĩ/AI.</li>
              </ul>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="policy-container" style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: isDark ? '#07080A' : '#F4F6FA',
      color: isDark ? '#FFF' : '#1D2939',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      <header className="policy-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: isDark ? '#11151D' : '#FFF',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button 
          onClick={() => navigate('/login')} 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: isDark ? '#FFF' : '#1D2939',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          <ArrowLeft size={18} />
          Quay lại Đăng nhập
        </button>

        <div className="policy-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity className="beat-animated" style={{ color: 'var(--color-primary)' }} size={20} />
          <span style={{ fontWeight: 800, letterSpacing: '0.5px', fontSize: '0.95rem' }}>CARDIOGUARD AI</span>
        </div>

        <button 
          onClick={onToggleTheme}
          style={{
            background: 'none',
            border: 'none',
            color: isDark ? '#FFF' : '#1D2939',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
          }}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main style={{ 
        flex: 1, 
        maxWidth: '800px', 
        width: '100%', 
        margin: '0 auto', 
        padding: '40px 24px' 
      }}>
        <div style={{
          backgroundColor: isDark ? '#11151D' : '#FFF',
          borderRadius: '16px',
          padding: '40px',
          border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}>
          {renderContent()}
        </div>
      </main>

      <footer style={{
        padding: '24px',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)',
        backgroundColor: isDark ? '#0B0D12' : '#EAECF0',
        borderTop: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '8px' }}>
          <a href="/privacy" style={{ color: 'inherit', textDecoration: 'none', fontWeight: path === '/privacy' ? 'bold' : 'normal' }} onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Chính sách bảo mật</a>
          <span>•</span>
          <a href="/terms" style={{ color: 'inherit', textDecoration: 'none', fontWeight: path === '/terms' ? 'bold' : 'normal' }} onClick={(e) => { e.preventDefault(); navigate('/terms'); }}>Điều khoản dịch vụ</a>
          <span>•</span>
          <a href="/data-deletion" style={{ color: 'inherit', textDecoration: 'none', fontWeight: path === '/data-deletion' ? 'bold' : 'normal' }} onClick={(e) => { e.preventDefault(); navigate('/data-deletion'); }}>Yêu cầu xóa dữ liệu</a>
        </div>
        <div>© 2026 CardioGuard AI. All rights reserved.</div>
      </footer>
    </div>
  );
};
