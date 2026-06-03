import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { API_URL } from '../config';
import { ShieldCheck, FileText, Search, UserCheck, UserX, AlertTriangle, Eye, X, Mail, Phone, Calendar, MapPin, Award } from 'lucide-react';

interface DoctorData {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  specialty?: string;
  department?: string;
  status: string;
  created_at?: string;
  gender?: string;
  date_of_birth?: string;
  address?: string;
  position?: string;
  experience_years?: number;
  license_number?: string;
  license_issued_date?: string;
  license_issued_by?: string;
  license_certificate_url?: string;
  cccd_front_url?: string;
  cccd_back_url?: string;
  is_verified?: boolean;
  verification_note?: string;
}

export const AdminDoctorVerification: React.FC = () => {
  const { accessToken } = useAuth();
  
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Action states
  const [note, setNote] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

  // For full screen image modal preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchDoctorsList = async () => {
    if (!accessToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const url = statusFilter === 'all' 
        ? `${API_URL}/admin/doctors` 
        : `${API_URL}/admin/doctors?status=${statusFilter}`;
        
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error('Không thể tải danh sách bác sĩ.');
      const data = await response.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      setDoctors(items);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tải danh sách bác sĩ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorsList();
  }, [accessToken, statusFilter]);

  const handleSelectDoctor = async (doctor: DoctorData) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setNote(doctor.verification_note || '');
    try {
      const response = await fetch(`${API_URL}/admin/doctors/${doctor.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) throw new Error('Không thể tải chi tiết bác sĩ');
      const data = await response.json();
      setSelectedDoctor(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi tải chi tiết bác sĩ');
      setSelectedDoctor(doctor);
    }
  };

  const handleAction = async (actionType: 'verify' | 'reject' | 'request-update') => {
    if (!selectedDoctor || !accessToken) return;
    
    if ((actionType === 'reject' || actionType === 'request-update') && !note.trim()) {
      setErrorMsg('Vui lòng nhập lý do hoặc nội dung yêu cầu bổ sung');
      return;
    }

    setSubmittingAction(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(`${API_URL}/admin/doctors/${selectedDoctor.id}/${actionType}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ verification_note: note })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Lỗi thực hiện thao tác.');
      }

      setSuccessMsg(`Thao tác thành công cho bác sĩ ${selectedDoctor.full_name}!`);
      setSelectedDoctor(null);
      fetchDoctorsList();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi thực thi yêu cầu.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filter list by search term
  const filteredDoctors = doctors.filter(doc => 
    doc.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.phone && doc.phone.includes(searchTerm)) ||
    (doc.specialty && doc.specialty.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getMediaUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}?token=${accessToken}`;
  };

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'active') return <span className="badge badge-success">Đã xác thực</span>;
    if (s === 'pending_verification') return <span className="badge badge-warning">Chờ xác thực</span>;
    if (s === 'rejected') return <span className="badge badge-danger">Từ chối</span>;
    if (s === 'need_update') return <span className="badge badge-info">Cần bổ sung</span>;
    return <span className="badge badge-secondary">Thiếu hồ sơ</span>;
  };

  return (
    <div className="admin-page-container" style={{ padding: '24px', backgroundColor: 'var(--color-bg-primary)', minHeight: '80vh' }}>
      
      {/* Title */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck style={{ color: 'var(--color-primary)' }} />
          Xác thực hồ sơ Bác sĩ
        </h1>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0' }}>
          Phê duyệt danh sách chứng chỉ hành nghề, giấy tờ tùy thân của bác sĩ đăng ký hoạt động.
        </p>
      </div>

      {errorMsg && (
        <div className="alert-message error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-message success" style={{ marginBottom: '16px' }}>
          <ShieldCheck size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* Left pane: Doctor list */}
        <div style={{ flex: '1 1 500px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid var(--color-border)' }}>
          
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Status tabs */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-bg-tertiary)', padding: '4px', borderRadius: '8px', overflowX: 'auto' }}>
              {[
                { label: 'Tất cả', value: 'all' },
                { label: 'Chờ duyệt', value: 'pending_verification' },
                { label: 'Đã duyệt', value: 'active' },
                { label: 'Từ chối', value: 'rejected' },
                { label: 'Cần bổ sung', value: 'need_update' }
              ].map(tab => (
                <button
                  key={tab.value}
                  type="button"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: statusFilter === tab.value ? 'var(--color-primary)' : 'transparent',
                    color: statusFilter === tab.value ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: statusFilter === tab.value ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-bg-tertiary)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--color-border)', width: '240px' }}>
              <Search size={16} style={{ color: 'var(--text-muted)', marginRight: '8px' }} />
              <input
                type="text"
                placeholder="Tìm tên, email, khoa..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.85rem', width: '100%', color: 'var(--text-primary)' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* List view */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Đang tải danh sách bác sĩ...</div>
          ) : filteredDoctors.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Không tìm thấy hồ sơ nào khớp yêu cầu.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
              {filteredDoctors.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: selectedDoctor?.id === doc.id ? 'var(--color-bg-tertiary)' : 'transparent',
                    border: selectedDoctor?.id === doc.id ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => handleSelectDoctor(doc)}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {doc.full_name}
                      {getStatusBadge(doc.status)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {doc.email} • Cch: {doc.specialty || 'Chưa cập nhật'}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-small"
                    style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Eye size={14} />
                    Xem
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right pane: Drawer detail */}
        {selectedDoctor ? (
          <div style={{ flex: '1 1 500px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Chi tiết hồ sơ xác thực
              </h2>
              <button 
                type="button" 
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => setSelectedDoctor(null)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Doctor Info Grid */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
              {selectedDoctor.license_certificate_url ? (
                <img 
                  src={getMediaUrl(selectedDoctor.license_certificate_url)} 
                  alt="Doctor" 
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--color-border)' }} 
                />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={32} style={{ color: 'var(--text-muted)' }} />
                </div>
              )}
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{selectedDoctor.full_name}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CCHN: {selectedDoctor.license_number || 'Chưa điền'}</span>
              </div>
            </div>

            {/* Detailed metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.85rem', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Mail size={14} />
                <span>{selectedDoctor.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Phone size={14} />
                <span>{selectedDoctor.phone || 'Chưa cập nhật'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <Calendar size={14} />
                <span>Sinh: {selectedDoctor.date_of_birth || 'Chưa cập nhật'} • Giới tính: {selectedDoctor.gender || 'Chưa cập nhật'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <MapPin size={14} />
                <span>Địa chỉ: {selectedDoctor.address || 'Chưa cập nhật'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', gridColumn: 'span 2' }}>
                <Award size={14} />
                <span>Chuyên khoa: {selectedDoctor.specialty || 'Chưa cập nhật'} • Kinh nghiệm: {selectedDoctor.experience_years !== undefined ? `${selectedDoctor.experience_years} năm` : 'Chưa cập nhật'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', gridColumn: 'span 2' }}>
                <FileText size={14} />
                <span>Nơi công tác: {selectedDoctor.department || 'Chưa cập nhật'} • Chức vụ: {selectedDoctor.position || 'Chưa cập nhật'}</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />

            {/* Verification Documents section */}
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>Giấy tờ xác minh pháp lý</h4>
            
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {/* 1. Chứng chỉ */}
              {selectedDoctor.license_certificate_url ? (
                <div style={{ flex: '1 1 120px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chứng chỉ y khoa</span>
                  <div 
                    style={{ height: '90px', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => setPreviewImage(getMediaUrl(selectedDoctor.license_certificate_url))}
                  >
                    <img src={getMediaUrl(selectedDoctor.license_certificate_url)} alt="License" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              ) : (
                <div style={{ flex: '1 1 120px', padding: '16px', backgroundColor: 'var(--color-bg-tertiary)', border: '1px dashed var(--color-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <FileText size={20} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Thiếu ảnh CCHN</span>
                </div>
              )}

              {/* 2. CCCD mặt trước */}
              {selectedDoctor.cccd_front_url ? (
                <div style={{ flex: '1 1 120px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CCCD Mặt trước</span>
                  <div 
                    style={{ height: '90px', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => setPreviewImage(getMediaUrl(selectedDoctor.cccd_front_url))}
                  >
                    <img src={getMediaUrl(selectedDoctor.cccd_front_url)} alt="CCCD Front" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              ) : (
                <div style={{ flex: '1 1 120px', padding: '16px', backgroundColor: 'var(--color-bg-tertiary)', border: '1px dashed var(--color-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <UserCheck size={20} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Thiếu CCCD trước</span>
                </div>
              )}

              {/* 3. CCCD mặt sau */}
              {selectedDoctor.cccd_back_url ? (
                <div style={{ flex: '1 1 120px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>CCCD Mặt sau</span>
                  <div 
                    style={{ height: '90px', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                    onClick={() => setPreviewImage(getMediaUrl(selectedDoctor.cccd_back_url))}
                  >
                    <img src={getMediaUrl(selectedDoctor.cccd_back_url)} alt="CCCD Back" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                </div>
              ) : (
                <div style={{ flex: '1 1 120px', padding: '16px', backgroundColor: 'var(--color-bg-tertiary)', border: '1px dashed var(--color-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  <UserCheck size={20} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Thiếu CCCD sau</span>
                </div>
              )}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />

            {/* Verification Notes & Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Ý kiến phản hồi / Lý do từ chối (Gửi tới bác sĩ)
              </label>
              <textarea
                placeholder="Nhập ghi chú phê duyệt hoặc lý do từ chối, yêu cầu bổ sung chi tiết..."
                rows={3}
                className="form-control"
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  disabled={submittingAction}
                  onClick={() => handleAction('verify')}
                >
                  <UserCheck size={16} />
                  Duyệt hồ sơ
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  disabled={submittingAction}
                  onClick={() => handleAction('reject')}
                >
                  <UserX size={16} />
                  Từ chối
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  disabled={submittingAction}
                  onClick={() => handleAction('request-update')}
                >
                  <AlertTriangle size={16} />
                  Yêu cầu bổ sung
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: '1 1 500px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--color-border)', height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Award size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <span>Chọn một bác sĩ từ danh sách để xem chi tiết hồ sơ xác thực và thực hiện phê duyệt.</span>
          </div>
        )}
      </div>

      {/* Full screen Image Preview Modal */}
      {previewImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px'
          }}
          onClick={() => setPreviewImage(null)}
        >
          <button 
            type="button"
            style={{ position: 'absolute', top: '24px', right: '24px', backgroundColor: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
            onClick={() => setPreviewImage(null)}
          >
            <X size={32} />
          </button>
          <img 
            src={previewImage} 
            alt="Preview" 
            style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }} 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
};
