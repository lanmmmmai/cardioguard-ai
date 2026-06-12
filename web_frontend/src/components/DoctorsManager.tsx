/**
 * @purpose Giao diện CRUD dành cho quản trị viên để quản lý tài khoản bác sĩ. Hỗ trợ
 *          tìm kiếm, thêm, sửa và xóa thông qua các biểu mẫu modal.
 * @workflow  1. Tải danh sách bác sĩ khi mount → 2. Người dùng có thể tìm kiếm theo tên,
 *            email hoặc số điện thoại → 3. Modal "Thêm": điền biểu mẫu → POST đến
 *            /admin/doctors → 4. Modal "Sửa": cập nhật trường → PUT đến
 *            /admin/doctors/:id → 5. Xác nhận "Xóa" → DELETE đến /admin/doctors/:id.
 * @relationships
 *   - AuthContext để lấy mã truy cập quản trị viên
 *   - passwordPolicy utility (isStrongPassword)
 *   - App.tsx (routeContent cho /admin/doctors)
 */
import React, { useEffect, useState } from 'react';
import { Search, X, Loader2, Plus, Edit2, Trash2, Stethoscope, Mail, Phone, Building } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';
import { isStrongPassword, passwordPolicyMessage } from '../utils/passwordPolicy';

interface Doctor {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  specialty: string | null;
  department: string | null;
  status: string;
  created_at: string | null;
}

/**
 * Bảng quản trị dành cho việc quản lý tài khoản bác sĩ: danh sách, tìm kiếm, thêm, sửa, xóa.
 */
export const DoctorsManager: React.FC = () => {
  const { accessToken } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('active');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchDoctors = React.useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/admin/doctors`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let data;

      try {

        data = await response.json();

      } catch (e) {

        throw new Error("Lỗi định dạng phản hồi từ server");

      }
      if (!response.ok) {
        throw new Error(data.detail || 'Không lấy được danh sách bác sĩ');
      }
      const items = Array.isArray(data) ? data : (data.items || []);
      setDoctors(items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const validateForm = (isEdit: boolean) => {
    if (!fullName.trim()) {
      return 'Họ và tên bắt buộc nhập';
    }
    if (!email.trim() || !email.includes('@')) {
      return 'Email không đúng định dạng';
    }
    if (!isEdit) {
      if (!password) {
        return 'Mật khẩu là bắt buộc';
      }
      if (!isStrongPassword(password)) {
        return passwordPolicyMessage;
      }
      if (password !== confirmPassword) {
        return 'Xác nhận mật khẩu không khớp';
      }
    } else {
      if (password && !isStrongPassword(password)) {
        return passwordPolicyMessage;
      }
      if (password && password !== confirmPassword) {
        return 'Xác nhận mật khẩu mới không khớp';
      }
    }
    return null;
  };

  const handleOpenAddModal = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setSpecialty('');
    setDepartment('');
    setPassword('');
    setConfirmPassword('');
    setStatus('active');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setFullName(doc.full_name || '');
    setEmail(doc.email || '');
    setPhone(doc.phone || '');
    setSpecialty(doc.specialty || '');
    setDepartment(doc.department || '');
    setPassword('');
    setConfirmPassword('');
    setStatus(doc.status || 'active');
    setFormError(null);
    setShowEditModal(true);
  };

  const handleOpenDeleteConfirm = (doc: Doctor) => {
    setSelectedDoctor(doc);
    setShowDeleteConfirm(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateForm(false);
    if (err) {
      setFormError(err);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const response = await fetch(`${API_URL}/admin/doctors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          password: password,
          confirm_password: confirmPassword,
          specialty: specialty.trim() || null,
          department: department.trim() || null,
          status,
        }),
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }
      if (!response.ok) {
        throw new Error(data.detail || 'Lỗi thêm bác sĩ mới');
      }

      setShowAddModal(false);
      fetchDoctors();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) return;

    const err = validateForm(true);
    if (err) {
      setFormError(err);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const updatePayload: Record<string, any> = {
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      specialty: specialty.trim() || null,
      department: department.trim() || null,
      status,
    };

    if (password) {
      updatePayload.password = password;
      updatePayload.confirm_password = confirmPassword;
    }

    try {
      const response = await fetch(`${API_URL}/admin/doctors/${selectedDoctor.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(updatePayload),
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }
      if (!response.ok) {
        throw new Error(data.detail || 'Lỗi cập nhật thông tin bác sĩ');
      }

      setShowEditModal(false);
      fetchDoctors();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedDoctor) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/admin/doctors/${selectedDoctor.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }
      if (!response.ok) {
        throw new Error(data.detail || 'Lỗi khi xóa bác sĩ');
      }

      setShowDeleteConfirm(false);
      fetchDoctors();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    if (statusFilter !== 'all' && doc.status !== statusFilter) {
      return false;
    }
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      (doc.full_name || '').toLowerCase().includes(term) ||
      (doc.email || '').toLowerCase().includes(term) ||
      (doc.phone || '').includes(term)
    );
  });

  return (
    <div>
      
      {error && (
        <div className="alert-strip high" style={{ marginBottom: '1rem' }}>
          <div className="alert-strip-body">
            <div className="alert-strip-desc">{error}</div>
          </div>
        </div>
      )}
<div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Stethoscope size={28} /> Quản lý bác sĩ
          </h1>
          <p className="page-subtitle">
            Quản trị danh sách bác sĩ chuyên khoa, phân phòng ban và cấp quyền truy cập hệ thống.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={16} /> Thêm bác sĩ
        </button>
      </div>

      <div className="panel" style={{ marginBottom: '1.5rem', padding: '12px 20px' }}>
        <div className="admin-toolbar-responsive">
          <div className="admin-toolbar-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Tìm kiếm theo tên, email hoặc số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '45px', border: 'none', background: 'transparent' }}
            />
          </div>

          <div className="admin-toolbar-selects">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Trạng thái:</span>
              <select 
                className="form-control" 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: '130px', padding: '6px 12px', height: '36px' }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Hoạt động (Đã duyệt)</option>
                <option value="inactive">Tạm ngưng</option>
                <option value="pending_verification">Chờ xác thực</option>
                <option value="rejected">Từ chối</option>
                <option value="need_update">Cần bổ sung</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 className="beat-animated" size={36} style={{ margin: '0 auto 1rem', color: 'var(--color-primary)' }} />
          <p>Đang tải danh sách bác sĩ...</p>
        </div>
      ) : error ? (
        <div className="alert-strip high" style={{ marginBottom: '1.5rem' }}>
          <div className="alert-strip-body">
            <div className="alert-strip-title">Lỗi kết nối</div>
            <div className="alert-strip-desc">{error}</div>
            <button className="btn btn-secondary" onClick={fetchDoctors} style={{ marginTop: '1rem', width: 'fit-content' }}>
              Thử lại
            </button>
          </div>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }}>
          <Stethoscope size={48} style={{ opacity: 0.3, marginBottom: '1.5rem' }} />
          <h3>Chưa có dữ liệu. Vui lòng thêm mới.</h3>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {searchQuery ? 'Không tìm thấy bác sĩ nào khớp với từ khóa tìm kiếm.' : 'Hệ thống chưa ghi nhận tài khoản bác sĩ nào.'}
          </p>
          {!searchQuery && (
            <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ marginTop: '1.5rem' }}>
              <Plus size={16} /> Thêm bác sĩ đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="cms-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '16px' }}>Họ và tên</th>
                  <th style={{ padding: '16px' }}>Thông tin liên lạc</th>
                  <th style={{ padding: '16px' }}>Chuyên khoa & Phòng</th>
                  <th style={{ padding: '16px' }}>Trạng thái</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--glass-border)' }} className="table-row-hover">
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className="patient-avatar" style={{ background: 'var(--color-spo2-glow)', color: 'var(--color-spo2)' }}>
                          {doc.full_name ? doc.full_name.charAt(0).toUpperCase() : 'B'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{doc.full_name}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mã: {doc.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={12} style={{ color: 'var(--text-muted)' }} /> {doc.email}
                        </span>
                        {doc.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Phone size={12} style={{ color: 'var(--text-muted)' }} /> {doc.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 500 }}>{doc.specialty || 'Chưa cập nhật chuyên khoa'}</span>
                        {doc.department && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            <Building size={10} /> {doc.department}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`patient-status ${doc.status === 'active' ? 'normal' : doc.status === 'inactive' ? 'critical' : 'warning'}`}>
                        {doc.status === 'active' ? 'Hoạt động' : 
                         doc.status === 'inactive' ? 'Tạm ngưng' : 
                         doc.status === 'pending_verification' ? 'Chờ duyệt' : 
                         doc.status === 'rejected' ? 'Từ chối' : 'Cần bổ sung'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', height: 'auto' }}
                          onClick={() => handleOpenEditModal(doc)}
                        >
                          <Edit2 size={14} /> Sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', height: 'auto', background: 'linear-gradient(135deg, var(--color-critical), #c2003c)' }}
                          onClick={() => handleOpenDeleteConfirm(doc)}
                        >
                          <Trash2 size={14} /> Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content panel" style={{ maxWidth: '550px' }}>
            <button
              onClick={() => setShowAddModal(false)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 className="auth-title" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Plus size={22} style={{ color: 'var(--color-primary)' }} /> Thêm Bác Sĩ Mới
            </h2>

            {formError && (
              <div className="alert-strip high" style={{ marginBottom: '1.25rem' }}>
                <div className="alert-strip-body">
                  <div className="alert-strip-desc">{formError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label>Họ và tên *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Bác sĩ Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="doctor@cardioguard.vn"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Chuyên khoa</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Nội tim mạch"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Khoa / Phòng ban</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Phòng khám ICU 1"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Mật khẩu *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Tối thiểu 6 ký tự"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Xác nhận mật khẩu *</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Trạng thái hoạt động</label>
                <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Hoạt động (Active)</option>
                  <option value="inactive">Tạm ngưng (Inactive)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="beat-animated" size={16} /> Đang lưu...
                    </>
                  ) : (
                    'Lưu thông tin'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedDoctor && (
        <div className="modal-overlay">
          <div className="modal-content panel" style={{ maxWidth: '550px' }}>
            <button
              onClick={() => setShowEditModal(false)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 className="auth-title" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Edit2 size={22} style={{ color: 'var(--color-primary)' }} /> Sửa Thông Tin Bác Sĩ
            </h2>

            {formError && (
              <div className="alert-strip high" style={{ marginBottom: '1.25rem' }}>
                <div className="alert-strip-body">
                  <div className="alert-strip-desc">{formError}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Họ và tên *</label>
                <input
                  type="text"
                  className="form-control"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Số điện thoại</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Chuyên khoa</label>
                  <input
                    type="text"
                    className="form-control"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Khoa / Phòng ban</label>
                  <input
                    type="text"
                    className="form-control"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '1.5rem', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Bỏ trống 2 ô bên dưới nếu không có nhu cầu đổi mật khẩu.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Mật khẩu mới</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Mật khẩu mới"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Xác nhận mật khẩu mới</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Xác nhận lại"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label>Trạng thái hoạt động</label>
                <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="active">Hoạt động (Active)</option>
                  <option value="inactive">Tạm ngưng (Inactive)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="beat-animated" size={16} /> Đang cập nhật...
                    </>
                  ) : (
                    'Cập nhật'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedDoctor && (
        <div className="modal-overlay">
          <div className="modal-content panel" style={{ maxWidth: '450px', textAlign: 'center' }}>
            <h2 className="auth-title" style={{ marginBottom: '1rem', color: 'var(--color-critical)' }}>
              Xác Nhận Xóa Bác Sĩ
            </h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
              Bạn có chắc chắn muốn xóa bác sĩ <strong>{selectedDoctor.full_name}</strong> khỏi hệ thống? 
              Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={isSubmitting}>
                Hủy bỏ
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ background: 'linear-gradient(135deg, var(--color-critical), #c2003c)' }} 
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="beat-animated" size={16} /> Đang xóa...
                  </>
                ) : (
                  'Đồng ý xóa'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
