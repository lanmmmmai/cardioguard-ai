import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Cpu, FileText, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';

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
    endpoint: '/appointments',
  },
  records: {
    icon: FileText,
    title: 'Bệnh Án & AI Hỗ Trợ',
    subtitle: 'Quản lý hồ sơ bệnh án, file y tế, kết quả khám và phân tích nguy cơ tim mạch.',
    endpoint: '/medical-records',
  },
  devices: {
    icon: Cpu,
    title: 'IoT Devices & Camera',
    subtitle: 'Quản lý thiết bị wearable, gateway ECG, camera ICU và trạng thái kết nối realtime.',
    endpoint: '/devices',
  },
};

export const FeatureHub: React.FC<FeatureHubProps> = ({ type, role, patients }) => {
  const { accessToken } = useAuth();
  const meta = pageMeta[type];
  const Icon = meta.icon;
  const visiblePatients = role === 'patient' ? patients.slice(0, 1) : patients;
  const [records, setRecords] = useState<Array<Record<string, any>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}${meta.endpoint}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let data;

      try {

        data = await response.json();

      } catch (e) {

        throw new Error("Lỗi định dạng phản hồi từ server");

      }
      if (!response.ok) throw new Error(data.detail || 'Không lấy được dữ liệu');
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [accessToken, meta.endpoint]);

  const primaryColumns = useMemo(() => {
    const keys = Array.from(new Set(records.flatMap((record) => Object.keys(record))));
    return keys.filter((key) => key !== 'updated_at').slice(0, 6);
  }, [records]);

  // Helper dịch tiêu đề cột sang tiếng Việt chuyên nghiệp cho lâm sàng/IoT
  const formatHeader = (col: string) => {
    const dict: Record<string, string> = {
      id: 'ID',
      patient_id: 'Mã bệnh nhân',
      doctor_id: 'Mã bác sĩ',
      title: 'Tiêu đề lịch khám',
      status: 'Trạng thái',
      channel: 'Hình thức khám',
      scheduled_at: 'Thời gian hẹn',
      appointment_date: 'Thời gian hẹn',
      reason: 'Lý do khám',
      notes: 'Ghi chú',
      note: 'Ghi chú',
      type: 'Phân loại',
      record_type: 'Phân loại',
      diagnosis: 'Chẩn đoán y khoa',
      summary: 'Tóm tắt lâm sàng',
      clinical_summary: 'Tóm tắt lâm sàng',
      treatment_plan: 'Phác đồ điều trị',
      symptoms: 'Triệu chứng',
      files: 'Tệp đính kèm',
      device_name: 'Tên thiết bị',
      device_type: 'Loại thiết bị',
      battery_level: 'Dung lượng pin',
      last_seen: 'Lần cuối trực tuyến',
      created_at: 'Ngày tạo',
    };
    return dict[col] || col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' ');
  };

  // Helper định dạng hiển thị giá trị lâm sàng/IoT thông minh
  const formatValue = (col: string, val: any) => {
    if (val === null || val === undefined) return '-';
    
    // 1. Định dạng Ngày tháng năm tiếng Việt
    if (col === 'scheduled_at' || col === 'appointment_date' || col === 'last_seen' || col === 'created_at') {
      try {
        return (
          <span className="tabular-nums" style={{ fontSize: '0.85rem' }}>
            {new Date(val).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })}
          </span>
        );
      } catch {
        return String(val);
      }
    }
    
    // 2. Huy hiệu Trạng thái sinh động
    if (col === 'status') {
      const statusStr = String(val).toLowerCase();
      if (statusStr === 'online' || statusStr === 'active' || statusStr === 'success' || statusStr === 'confirmed') {
        return (
          <span className="patient-status normal" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
            {statusStr === 'confirmed' ? 'ĐÃ XÁC NHẬN' : String(val).toUpperCase()}
          </span>
        );
      }
      if (statusStr === 'offline' || statusStr === 'inactive' || statusStr === 'failed' || statusStr === 'pending') {
        return (
          <span className="patient-status critical" style={{ display: 'inline-flex', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: statusStr === 'pending' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 51, 102, 0.1)', color: statusStr === 'pending' ? '#f59e0b' : 'var(--color-critical)', border: statusStr === 'pending' ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(255, 51, 102, 0.2)' }}>
            {statusStr === 'pending' ? 'CHỜ XÁC NHẬN' : String(val).toUpperCase()}
          </span>
        );
      }
    }
    
    // 3. Rút ngắn mã UUID phức tạp kèm tooltip
    if (String(val).length > 30 && /^[0-9a-fA-F-]{36}$/.test(String(val))) {
      return (
        <span title={String(val)} className="tabular-nums" style={{ fontFamily: 'monospace', opacity: 0.85, fontSize: '0.82rem', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
          {String(val).slice(0, 8)}...
        </span>
      );
    }
    
    // 4. Pin (Battery level) hiển thị kèm %
    if (col === 'battery_level') {
      const bat = Number(val);
      const color = bat > 50 ? 'var(--color-bp)' : bat > 20 ? '#f59e0b' : 'var(--color-critical)';
      return (
        <span style={{ fontWeight: 700, color, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          🔋 {bat}%
        </span>
      );
    }

    // 5. Định dạng File y tế JSON
    if (col === 'files') {
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        if (Array.isArray(parsed)) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {parsed.map((f: any, i) => (
                <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 600 }}>
                  📄 {f.name || 'Tệp đính kèm'}
                </a>
              ))}
            </div>
          );
        }
      } catch {
        // Fallback
      }
    }
    
    return String(val);
  };

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

      <div className="panel" style={{ marginBottom: '1.5rem', padding: '20px' }}>
        <div className="metric-header" style={{ marginBottom: '1.25rem' }}>
          <span className="metric-title" style={{ fontSize: '0.95rem', fontWeight: 700 }}>Dữ liệu thật từ Supabase</span>
          <button type="button" className="btn btn-secondary" onClick={fetchRecords} disabled={loading}>
            <RefreshCw size={14} /> Làm mới
          </button>
        </div>
        
        {loading ? (
          <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="beat-animated" style={{ margin: '0 auto 10px', color: 'var(--color-primary)' }} />
            Đang tải dữ liệu thực tế từ máy chủ...
          </div>
        ) : error ? (
          <div className="alert-strip high">
            <AlertTriangle size={16} className="alert-strip-icon" />
            <div className="alert-strip-body">
              <div className="alert-strip-title">Không thể tải dữ liệu</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Chưa có bản ghi thật nào trong bảng này theo phân quyền của bạn.
          </div>
        ) : (
          <div className="cms-table-wrap" style={{ border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
            <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {primaryColumns.map((column) => (
                    <th key={column} style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--glass-border)', textTransform: 'none' }}>
                      {formatHeader(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 12).map((record, index) => (
                  <tr key={String(record.id || index)} className="table-row-hover" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    {primaryColumns.map((column) => (
                      <td key={column} style={{ padding: '14px 16px', verticalAlign: 'middle', color: 'var(--text-primary)' }}>
                        {formatValue(column, record[column])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
