/**
 * @purpose Liệt kê các tài khoản bệnh nhân đã xác thực OTP với tính năng tìm kiếm
 *           và cung cấp biểu mẫu modal "Thêm bệnh nhân".
 * @workflow Lọc bệnh nhân theo truy vấn tìm kiếm qua useMemo; modal chuyển đổi
 *           showAddModal để tạo bản ghi bệnh nhân mới qua POST đến API.
 * @relationships Component cha: App (nhận danh sách bệnh nhân + callback); Sử dụng: config cho API_URL.
 */
import React, { useState, useMemo } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { API_URL } from '../config';
import { Patient } from '../types';

interface PatientsProps {
  patients: Patient[];
  accessToken: string | null;
  onPatientAdded: () => void;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  onViewPatientDetail: (patientId: string) => void;
}

/**
 * Component Patients — hiển thị danh sách bệnh nhân có thể tìm kiếm và modal thêm bệnh nhân.
 */
export const Patients: React.FC<PatientsProps> = ({ 
  patients, 
  accessToken,
  onPatientAdded,
  showAddModal,
  setShowAddModal,
  onViewPatientDetail
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Nam');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return patients.filter(p => 
      p.full_name.toLowerCase().includes(q) ||
      p.phone.includes(searchQuery)
    );
  }, [patients, searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !age || !phone) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc (Tên, Tuổi, Sđt)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          full_name: fullName,
          age: parseInt(age),
          gender,
          phone,
          address,
          medical_history: medicalHistory
        }),
      });

      let data;

      try {

        data = await response.json();

      } catch (e) {

        throw new Error("Lỗi định dạng phản hồi từ server");

      }

      if (!response.ok) {
        throw new Error(data.detail || 'Lỗi thêm bệnh nhân mới');
      }

      setFullName('');
      setAge('');
      setGender('Nam');
      setPhone('');
      setAddress('');
      setMedicalHistory('');
      
      setShowAddModal(false);
      onPatientAdded();
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

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

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content panel">
            <button 
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 className="auth-title" style={{ marginBottom: '1.5rem' }}>Đăng Ký Bệnh Nhân Mới</h2>

            {error && (
              <div className="alert-strip high" style={{ marginBottom: '1.25rem' }}>
                <div className="alert-strip-body">
                  <div className="alert-strip-desc">{error}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Họ và tên *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Tuổi *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="45"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Giới tính</label>
                  <select
                    className="form-control"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Số điện thoại *</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="0987654321"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Địa chỉ</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Quận 1, TP. Hồ Chí Minh"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Tiền sử bệnh lý (nếu có)</label>
                <textarea
                  className="form-control"
                  placeholder="Suy tim độ 2, Cao huyết áp..."
                  value={medicalHistory}
                  onChange={(e) => setMedicalHistory(e.target.value)}
                  rows={2}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="beat-animated" size={16} /> Lưu hồ sơ...
                    </>
                  ) : (
                    'Lưu bệnh nhân'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
