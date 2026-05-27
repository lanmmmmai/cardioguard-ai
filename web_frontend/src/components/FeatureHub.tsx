import React from 'react';
import { AlertTriangle, CalendarDays, Cpu, FileText, ShieldCheck, Sparkles } from 'lucide-react';

interface Patient {
  id: string;
  full_name: string;
  age: number;
  gender: string;
}

type FeatureType = 'appointments' | 'records' | 'devices';

interface FeatureHubProps {
  type: FeatureType;
  role: string;
  patients: Patient[];
}

const aiDisclaimer = 'Kết quả AI chỉ mang tính tham khảo, cần bác sĩ xác nhận trước khi sử dụng cho quyết định điều trị.';

const moduleSections = {
  appointments: [
    { title: 'Đặt lịch khám', status: 'Module', detail: 'Tạo lịch, chọn bác sĩ/phòng khám và gửi yêu cầu xác nhận.' },
    { title: 'Xác nhận & dời lịch', status: 'Module', detail: 'Quản lý trạng thái lịch hẹn, hủy hoặc dời lịch theo quyền.' },
    { title: 'Tư vấn trực tuyến', status: 'Module', detail: 'Không gian chuẩn bị cho video call và chat bảo mật.' },
  ],
  records: [
    { title: 'Bệnh án điện tử', status: 'Module', detail: 'Chẩn đoán, lịch sử khám, file PDF/X-ray/xét nghiệm.' },
    { title: 'Phân tích xu hướng sức khỏe', status: 'AI hỗ trợ', detail: 'Tổng hợp nhịp tim, SpO2, huyết áp theo thời gian khi có dữ liệu thật.' },
    { title: 'Quản lý file y tế', status: 'Module', detail: 'Sẵn sàng nối API upload khi backend có object storage.' },
  ],
  devices: [
    { title: 'Wearable devices', status: 'Module', detail: 'Khai báo smartwatch/vòng đeo và trạng thái pin/kết nối.' },
    { title: 'ECG Gateway', status: 'Module', detail: 'Chuẩn bị vùng quản lý gateway ECG và stream realtime.' },
    { title: 'Camera ICU', status: 'Module', detail: 'Theo dõi té ngã, sự kiện bất thường và lưu video cảnh báo.' },
  ],
};

const pageMeta = {
  appointments: {
    icon: CalendarDays,
    title: 'Lịch Hẹn & Tư Vấn',
    subtitle: 'Đặt lịch, xác nhận, dời lịch, thống kê lịch khám và tư vấn trực tuyến.',
  },
  records: {
    icon: FileText,
    title: 'Bệnh Án & AI Hỗ Trợ',
    subtitle: 'Quản lý hồ sơ bệnh án, file y tế, kết quả khám và phân tích nguy cơ tim mạch.',
  },
  devices: {
    icon: Cpu,
    title: 'IoT Devices & Camera',
    subtitle: 'Quản lý thiết bị wearable, gateway ECG, camera ICU và trạng thái kết nối realtime.',
  },
};

export const FeatureHub: React.FC<FeatureHubProps> = ({ type, role, patients }) => {
  const meta = pageMeta[type];
  const Icon = meta.icon;
  const visiblePatients = role === 'patient' ? patients.slice(0, 1) : patients;

  return (
    <div>
      <div className="page-header" style={{ gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Icon size={28} /> {meta.title}
          </h1>
          <p className="page-subtitle">{meta.subtitle}</p>
        </div>
        <span className="badge" style={{ background: 'var(--color-spo2-glow)', color: 'var(--color-spo2)' }}>
          Role: {role || 'doctor'}
        </span>
      </div>

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {moduleSections[type].map((item) => (
          <div className="panel" key={item.title} style={{ minHeight: '150px' }}>
            <div className="metric-header">
              <span className="metric-title">{item.title}</span>
              <span className="badge" style={{ whiteSpace: 'nowrap' }}>{item.status}</span>
            </div>
            <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid-2-3">
        <div className="panel">
          <h3 className="metric-title" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '1rem' }}>
            <ShieldCheck size={16} /> Phân quyền & dữ liệu theo vai trò
          </h3>
          {visiblePatients.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: '1.5rem 0' }}>
              Chưa có tài khoản Patient đã xác thực OTP để hiển thị trong module này.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visiblePatients.slice(0, 5).map((patient) => (
                <div key={patient.id} className="patient-row" style={{ cursor: 'default' }}>
                  <div className="patient-avatar">{patient.full_name.charAt(0).toUpperCase()}</div>
                  <div className="patient-main-info">
                    <div className="patient-name">{patient.full_name}</div>
                    <div className="patient-meta">{patient.gender} - {patient.age} tuổi - Mã BN: {patient.id.slice(0, 8)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ height: 'fit-content' }}>
          <h3 className="metric-title" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '1rem' }}>
            <Sparkles size={16} /> AI Risk Assistant
          </h3>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            AI đang sẵn sàng phân tích nguy cơ bệnh tim, phát hiện bất thường chỉ số sức khỏe, gợi ý chẩn đoán và hỗ trợ đọc kết quả xét nghiệm khi backend AI được kết nối.
          </p>
          <div className="alert-strip medium" style={{ marginTop: '1rem' }}>
            <AlertTriangle size={16} className="alert-strip-icon" />
            <div className="alert-strip-body">
              <div className="alert-strip-title">Cảnh báo y khoa</div>
              <div className="alert-strip-desc">{aiDisclaimer}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
