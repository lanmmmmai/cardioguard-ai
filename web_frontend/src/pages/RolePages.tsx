import React from 'react';
import { Activity, AlertTriangle, BarChart3, CalendarDays, Cpu, HeartPulse, MessageCircle, Pill, ShieldAlert, Stethoscope, Users } from 'lucide-react';

interface Patient {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  medical_history: string;
}

interface Alert {
  id?: string;
  patient_id: string;
  full_name?: string;
  alert_type: string;
  message: string;
  severity: string;
  is_resolved?: boolean;
  created_at?: string;
}

interface SensorData {
  patient_id: string;
  heart_rate: number;
  spo2: number;
  systolic_bp: number;
  diastolic_bp: number;
  ecg_value: number;
  is_abnormal: boolean;
  alerts: Array<{ alert_type: string; message: string; severity: string }>;
}

const Card: React.FC<{ icon: React.ReactNode; label: string; value: string | number; hint: string; tone?: string }> = ({ icon, label, value, hint, tone }) => (
  <div className={`role-stat-card ${tone || ''}`}>
    <div className="role-stat-icon">{icon}</div>
    <div>
      <div className="role-stat-label">{label}</div>
      <div className="role-stat-value">{value}</div>
      <div className="role-stat-hint">{hint}</div>
    </div>
  </div>
);

export const AdminDashboard: React.FC<{ patients: Patient[]; alerts: Alert[]; doctors?: any[] }> = ({ patients, alerts, doctors = [] }) => {
  const highAlerts = alerts.filter((alert) => alert.severity === 'high').length;
  const chartValues = [patients.length, alerts.length, highAlerts, doctors.length, 0, 0, 0];
  const maxChartValue = Math.max(...chartValues, 1);

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Admin</h1>
          <p className="page-subtitle">Tổng quan vận hành hệ thống CardioGuard AI.</p>
        </div>
      </div>

      <div className="role-stat-grid">
        <Card icon={<Users size={22} />} label="Tổng số bệnh nhân" value={patients.length} hint="Đang được quản lý" />
        <Card icon={<Stethoscope size={22} />} label="Tổng số bác sĩ" value={doctors.length} hint="Đang hoạt động" />
        <Card icon={<Cpu size={22} />} label="Thiết bị IoT" value="0" hint="Chưa có thiết bị thật được liên kết" />
        <Card icon={<ShieldAlert size={22} />} label="Cảnh báo" value={alerts.length} hint={`${highAlerts} cảnh báo mức cao`} tone="danger" />
      </div>

      <div className="role-page-grid">
        <section className="panel">
          <h3 className="metric-title"><BarChart3 size={18} /> Biểu đồ thống kê</h3>
          <div className="real-chart-bars">
            {chartValues.map((value, index) => (
              <span key={index} style={{ height: `${Math.max(8, (value / maxChartValue) * 100)}%` }} title={`${value}`} />
            ))}
          </div>
          <p className="role-muted">Biểu đồ chỉ dùng dữ liệu thật hiện có, không tạo bệnh nhân ảo.</p>
        </section>

        <section className="panel">
          <h3 className="metric-title"><Activity size={18} /> Hoạt động hệ thống gần đây</h3>
          <div className="activity-list">
            <div>Đồng bộ telemetry realtime thành công.</div>
            <div>WebSocket `/ws/realtime` đang sẵn sàng.</div>
            <div>AI risk assistant ở chế độ hỗ trợ tham khảo, cần bác sĩ xác nhận.</div>
            <div>Audit log ghi nhận phiên đăng nhập mới.</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export const DoctorDashboard: React.FC<{ patients: Patient[]; alerts: Alert[] }> = ({ patients, alerts }) => (
  <div className="role-page-stack">
    <div className="page-header">
      <div>
        <h1 className="page-title">Dashboard Bác sĩ</h1>
        <p className="page-subtitle">Theo dõi bệnh nhân, lịch hẹn và cảnh báo cần xử lý.</p>
      </div>
    </div>

    <div className="role-stat-grid">
      <Card icon={<Users size={22} />} label="Bệnh nhân được phân công" value={patients.length} hint="Danh sách hiện có" />
      <Card icon={<CalendarDays size={22} />} label="Lịch hẹn hôm nay" value="0" hint="Chưa có lịch hẹn thật" />
      <Card icon={<AlertTriangle size={22} />} label="Cảnh báo cần xử lý" value={alerts.filter((a) => a.severity === 'high').length} hint="Ưu tiên can thiệp" tone="danger" />
      <Card icon={<HeartPulse size={22} />} label="Realtime monitoring" value={patients.length} hint="Dựa trên bệnh nhân đã xác thực" />
    </div>

    <section className="panel">
      <h3 className="metric-title">Truy cập nhanh</h3>
      <div className="quick-action-grid">
        {['Bệnh án điện tử', 'Kê đơn thuốc', 'Chat tư vấn', 'AI phân tích sức khỏe'].map((item) => (
          <div className="quick-action-card" key={item}>{item}</div>
        ))}
      </div>
      <div className="alert-strip medium" style={{ marginTop: '1rem' }}>
        <AlertTriangle size={16} className="alert-strip-icon" />
        <div className="alert-strip-body">
          <div className="alert-strip-title">Lưu ý AI</div>
          <div className="alert-strip-desc">Kết quả AI chỉ mang tính tham khảo, cần bác sĩ xác nhận.</div>
        </div>
      </div>
    </section>
  </div>
);

export const PatientHome: React.FC<{ latestTelemetry: SensorData | null; alerts: Alert[] }> = ({ latestTelemetry, alerts }) => {
  const heartRate = latestTelemetry ? `${latestTelemetry.heart_rate} bpm` : 'Chưa có dữ liệu';
  const spo2 = latestTelemetry ? `${latestTelemetry.spo2}%` : 'Chưa có dữ liệu';
  const bp = latestTelemetry ? `${latestTelemetry.systolic_bp}/${latestTelemetry.diastolic_bp}` : 'Chưa có dữ liệu';
  const ecg = latestTelemetry ? latestTelemetry.ecg_value : 'Chưa có dữ liệu';

  return (
    <div className="role-page-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trang chủ bệnh nhân</h1>
          <p className="page-subtitle">Chỉ số sức khỏe mới nhất, lịch hẹn, đơn thuốc và hỗ trợ khẩn cấp.</p>
        </div>
        <button className="sos-button">SOS khẩn cấp</button>
      </div>

      <div className="role-stat-grid">
        <Card icon={<HeartPulse size={22} />} label="Heart Rate" value={heartRate} hint="Nhịp tim gần nhất" />
        <Card icon={<Activity size={22} />} label="SpO2" value={spo2} hint="Độ bão hòa oxy" />
        <Card icon={<BarChart3 size={22} />} label="Huyết áp" value={bp} hint="mmHg" />
        <Card icon={<Activity size={22} />} label="ECG" value={ecg} hint="Tín hiệu realtime" />
      </div>

      <div className="role-page-grid">
        <section className="panel">
          <h3 className="metric-title"><ShieldAlert size={18} /> Cảnh báo cá nhân</h3>
          {alerts.length === 0 ? (
            <p className="role-muted">Chưa có cảnh báo sức khỏe mới.</p>
          ) : (
            <div className="activity-list">
              {alerts.slice(0, 4).map((alert, index) => (
                <div key={`${alert.message}-${index}`}>{alert.message}</div>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h3 className="metric-title"><CalendarDays size={18} /> Lịch hẹn & đơn thuốc</h3>
          <div className="activity-list">
            <div>Chưa có lịch hẹn thật được đồng bộ.</div>
            <div>Chưa có đơn thuốc thật được đồng bộ.</div>
            <div><MessageCircle size={14} /> Chat với bác sĩ khi có triệu chứng bất thường.</div>
            <div><Pill size={14} /> Uống thuốc đúng giờ theo chỉ định.</div>
          </div>
        </section>
      </div>
    </div>
  );
};

export const PlaceholderPage: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="role-page-stack">
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
    </div>

    <div className="module-detail-grid">
      <section className="panel module-hero-card">
        <div className="module-hero-mark">CG</div>
        <h2>Tính năng đang được phát triển / Đang chờ tích hợp backend</h2>
        <p>
          Trang này đã được thiết lập route và phân quyền truy cập. Tính năng này hiện tại chưa có dữ liệu thật hoặc đang trong quá trình chờ tích hợp đầy đủ từ backend. Vui lòng không sử dụng cho mục đích vận hành lâm sàng thực tế.
        </p>
      </section>

      <section className="panel">
        <h3 className="metric-title">Luồng xử lý</h3>
        <div className="activity-list">
          <div>1. Kết nối và nhận dữ liệu thực từ các dịch vụ API backend.</div>
          <div>2. Hiển thị trạng thái tải (loading), dữ liệu rỗng (empty state) và xử lý lỗi thay vì màn hình trắng.</div>
          <div>3. Tự động ghi lại nhật ký kiểm toán (audit log) cho các thao tác lâm sàng quan trọng.</div>
        </div>
      </section>
    </div>

    <div className="quick-action-grid">
      {['Danh sách', 'Chi tiết', 'Tạo/Cập nhật', 'Báo cáo'].map((item) => (
        <div className="quick-action-card" key={item}>{item}</div>
      ))}
    </div>

    <div className="alert-strip medium">
      <AlertTriangle size={16} className="alert-strip-icon" />
      <div className="alert-strip-body">
        <div className="alert-strip-title">Không dùng dữ liệu bệnh nhân ảo</div>
        <div className="alert-strip-desc">Các danh sách bệnh nhân chỉ lấy từ tài khoản Patient đã xác thực OTP.</div>
      </div>
    </div>
  </div>
);
