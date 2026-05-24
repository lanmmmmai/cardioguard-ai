import React, { useState } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
import { API_URL } from '../config';

interface Patient {
  id: string;
  full_name: string;
  age: number;
  gender: string;
  phone: string;
  address: string;
  medical_history: string;
}

interface PatientsProps {
  patients: Patient[];
  onPatientAdded: () => void;
  showAddModal: boolean;
  setShowAddModal: (show: boolean) => void;
  onViewPatientDetail: (patientId: string) => void;
}

export const Patients: React.FC<PatientsProps> = ({ 
  patients, 
  onPatientAdded,
  showAddModal,
  setShowAddModal,
  onViewPatientDetail
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Nam');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter patients by search query
  const filteredPatients = patients.filter(p => 
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone.includes(searchQuery)
  );

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Lỗi thêm bệnh nhân mới');
      }

      // Reset form
      setFullName('');
      setAge('');
      setGender('Nam');
      setPhone('');
      setAddress('');
      setMedicalHistory('');
      
      setShowAddModal(false);
      onPatientAdded(); // refresh patient list
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
          <h1 className="page-title">Hồ Sơ Bệnh Nhân</h1>
          <p className="page-subtitle">Quản lý danh sách và hồ sơ bệnh án của bệnh nhân ({patients.length})</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={18} /> Đăng ký bệnh nhân
        </button>
      </div>

      {/* Search Input bar */}
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

      {/* Patient rows list */}
      <div className="patient-list">
        {filteredPatients.length === 0 ? (
          <div className="panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Không tìm thấy bệnh nhân nào khớp với từ khóa tìm kiếm.
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
                  <span>{p.gender}</span> •{' '}
                  <span>{p.age} tuổi</span> •{' '}
                  <span>SĐT: {p.phone}</span>
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

      {/* Add Patient Modal overlay */}
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
