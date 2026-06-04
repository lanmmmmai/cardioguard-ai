/**
 * @purpose Liệt kê các tài khoản bệnh nhân đã xác thực OTP với tính năng tìm kiếm.
 * @workflow Lọc bệnh nhân theo truy vấn tìm kiếm qua useMemo và điều hướng đến
 *           chi tiết hồ sơ khi người dùng chọn một hàng.
 * @relationships Component cha: App; không còn gọi trực tiếp luồng tạo bệnh nhân
 *                vì backend yêu cầu đăng ký qua OTP.
 */
import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Patient } from '../types';

interface PatientsProps {
  patients: Patient[];
  onViewPatientDetail: (patientId: string) => void;
}

/**
 * Component Patients — hiển thị danh sách bệnh nhân có thể tìm kiếm.
 */
export const Patients: React.FC<PatientsProps> = ({ 
  patients, 
  onViewPatientDetail
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return patients.filter(p => 
      p.full_name.toLowerCase().includes(q) ||
      p.phone.includes(searchQuery)
    );
  }, [patients, searchQuery]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bệnh Nhân Đã Xác Thực OTP</h1>
          <p className="page-subtitle">
            Danh sách này chỉ lấy từ tài khoản Patient đã đăng ký và xác thực OTP qua email ({patients.length}).
          </p>
        </div>
        <span className="badge" style={{ background: 'var(--color-bp-glow)', color: 'var(--color-bp)' }}>
          Verified accounts only
        </span>
      </div>

      <div className="panel" style={{ marginBottom: '1.5rem', padding: '12px 20px' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Tìm kiếm bệnh nhân theo tên hoặc số điện thoại..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '45px', border: 'none', background: 'transparent' }}
          />
        </div>
      </div>

      <div className="patient-list">
        {filteredPatients.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Chưa có tài khoản bệnh nhân đã xác thực OTP hoặc không tìm thấy kết quả phù hợp.
          </div>
        ) : (
          filteredPatients.map(p => (
            <div key={p.id} className="patient-row" onClick={() => onViewPatientDetail(p.id)} title="Click để xem chi tiết bệnh nhân">
              <div className="patient-avatar">
                {p.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="patient-main-info">
                <div className="patient-name">{p.full_name}</div>
                <div className="patient-meta">
                  <span>Mã BN: {p.id.slice(0, 8)}...</span> •{' '}
                  <span>{p.gender || 'Chưa cập nhật'}</span> •{' '}
                  <span>{p.age > 0 ? `${p.age} tuổi` : 'Chưa cập nhật tuổi'}</span> •{' '}
                  <span>Email: {p.phone}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                <div style={{ fontSize: '0.85rem', textAlign: 'right' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Tiền sử y tế</span>
                  <span style={{ color: p.medical_history ? 'var(--color-warning)' : 'var(--text-primary)', fontWeight: 500 }}>
                    {p.medical_history || 'Không'}
                  </span>
                </div>
                <span className="patient-status normal">Đang theo dõi</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
