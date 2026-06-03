/**
 * @purpose Quản lý người dùng dành cho quản trị viên: danh sách, tìm kiếm, lọc, thêm,
 *          sửa và xóa tài khoản người dùng.
 * @workflow Tải danh sách người dùng từ /admin/users khi mount; quản lý ba luồng
 *           modal (thêm/sửa/xóa) với xác thực biểu mẫu; hỗ trợ lọc theo vai trò/trạng
 *           thái và tìm kiếm.
 * @relationships Sử dụng AuthContext để lấy accessToken; tương tác với các endpoint API quản trị;
 *                Sử dụng passwordPolicy util để kiểm tra độ mạnh mật khẩu.
 */
import React, { useEffect, useState } from 'react';
import { Search, X, Loader2, Plus, Edit2, Trash2, User, Mail, Phone, UserCog, Shield, Activity, Lock, AlertOctagon } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';
import { isStrongPassword, passwordPolicyMessage } from '../utils/passwordPolicy';

interface UserAccount {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  created_at: string | null;
}

/**
 * Component UsersManager — bảng quản trị CRUD cho tài khoản người dùng với tìm kiếm/lọc.
 * Quản lý ba modal: Thêm, Sửa (có đặt lại mật khẩu tùy chọn) và Xác nhận Xóa.
 */
const accountCreatedAtFormatter = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const parseAccountDate = (dateStr: string | null) => {
  if (!dateStr) return null;
  let normalizedStr = dateStr;
  if (!dateStr.includes('Z') && !/\+\d{2}:?\d{2}$/.test(dateStr) && !/-\d{2}:?\d{2}$/.test(dateStr)) {
    normalizedStr = dateStr + 'Z';
  }
  const date = new Date(normalizedStr);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatRelativeCreatedAt = (dateStr: string | null, now: Date) => {
  const date = parseAccountDate(dateStr);
  if (!date) return 'Không có thời gian server';

  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSeconds < 10) return 'vừa tạo';
  if (diffSeconds < 60) return `${diffSeconds} giây trước`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} ngày trước`;

  return 'đã tạo trước đó';
};
export const UsersManager: React.FC = () => {
  const { accessToken, user } = useAuth();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('patient');
  const [status, setStatus] = useState('active');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = React.useCallback(async (showSpinner = true) => {
    if (!accessToken) {
      setUsers([]);
      setIsLoading(false);
      return;
    }
    if (showSpinner) setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let data;

      try {

        data = await response.json();

      } catch (e) {

        throw new Error("Lỗi định dạng phản hồi từ server");

      }
      if (!response.ok) {
        throw new Error(data.detail || 'Không lấy được danh sách tài khoản');
      }
      const items = Array.isArray(data) ? data : (data.items || []);
      setUsers(items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchUsers(true);
    const refreshInterval = window.setInterval(() => fetchUsers(false), 30000);
    return () => window.clearInterval(refreshInterval);
  }, [fetchUsers]);

  useEffect(() => {
    const clockInterval = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(clockInterval);
  }, []);

  const validateForm = (isEdit: boolean) => {
    if (!fullName.trim()) {
      return 'Họ và tên bắt buộc nhập';
    }
    if (!email.trim() || !email.includes('@')) {
      return 'Email không đúng định dạng';
    }
    if (phone.trim() && !/^[0-9+() .-]{7,20}$/.test(phone.trim())) {
      return 'Số điện thoại không đúng định dạng (7-20 chữ số)';
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
    setRole('patient');
    setStatus('active');
    setPassword('');
    setConfirmPassword('');
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (userAcc: UserAccount) => {
    setSelectedUser(userAcc);
    setFullName(userAcc.full_name || '');
    setEmail(userAcc.email || '');
    setPhone(userAcc.phone || '');
    setRole(userAcc.role || 'patient');
    setStatus(userAcc.status || 'active');
    setPassword('');
    setConfirmPassword('');
    setFormError(null);
    setShowEditModal(true);
  };

  const handleOpenDeleteConfirm = (userAcc: UserAccount) => {
    if (userAcc.id === user?.id) {
      setError('Không thể tự xóa tài khoản đang đăng nhập');
      return;
    }
    setSelectedUser(userAcc);
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
      const response = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || null,
          role: role,
          password: password,
          status: status,
        }),
      });

      let data;


      try {


        data = await response.json();


      } catch (e) {


        throw new Error("Lỗi định dạng phản hồi từ server");


      }
      if (!response.ok) {
        throw new Error(data.detail || 'Lỗi thêm tài khoản mới');
      }

      setUsers((prev) => [data as UserAccount, ...prev.filter((item) => item.id !== data.id)]);
      setShowAddModal(false);
      fetchUsers(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

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
      role: role,
      status: status,
    };

    if (password) {
      updatePayload.password = password;
    }

    try {
      const response = await fetch(`${API_URL}/admin/users/${selectedUser.id}`, {
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
        throw new Error(data.detail || 'Lỗi cập nhật tài khoản');
      }

      setUsers((prev) => prev.map((item) => (item.id === selectedUser.id ? data as UserAccount : item)));
      setShowEditModal(false);
      fetchUsers(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/admin/users/${selectedUser.id}`, {
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
        throw new Error(data.detail || 'Lỗi khi xóa tài khoản');
      }

      setUsers((prev) => prev.filter((item) => item.id !== selectedUser.id));
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      fetchUsers(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ');
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((userAcc) => {
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch = !term || (
      (userAcc.full_name || '').toLowerCase().includes(term) ||
      (userAcc.email || '').toLowerCase().includes(term) ||
      (userAcc.phone || '').includes(term)
    );

    const matchesRole = roleFilter === 'all' || userAcc.role === roleFilter;

    const matchesStatus = statusFilter === 'all' || userAcc.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadgeStyle = (userRole: string) => {
    switch (userRole.toLowerCase()) {
      case 'admin':
        return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'doctor':
        return { background: 'rgba(20, 184, 166, 0.1)', color: '#20b2aa', border: '1px solid rgba(20, 184, 166, 0.2)' };
      default:
        return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
    }
  };

  const getRoleLabel = (userRole: string) => {
    switch (userRole.toLowerCase()) {
      case 'admin':
        return 'Quản trị viên';
      case 'doctor':
        return 'Bác sĩ';
      default:
        return 'Bệnh nhân';
    }
  };

  const formatDate = (dateStr: string | null) => {
    const date = parseAccountDate(dateStr);
    if (!date) return 'Chưa có thời gian';
    return accountCreatedAtFormatter.format(date);
  };

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
            <UserCog size={28} /> Quản lý tài khoản
          </h1>
          <p className="page-subtitle">
            Phân quyền hệ thống, theo dõi trạng thái hoạt động và quản trị toàn bộ tài khoản người dùng CardioGuard.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenAddModal}>
          <Plus size={16} /> Thêm tài khoản
        </button>
      </div>

      <div className="panel" style={{ marginBottom: '1.5rem', padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '16px', alignItems: 'center' }}>
          
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '45px', border: 'none', background: 'transparent' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Vai trò:</span>
            <select 
              className="form-control" 
              value={roleFilter} 
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{ minWidth: '130px', padding: '6px 12px', height: '36px' }}
            >
              <option value="all">Tất cả vai trò</option>
              <option value="admin">Quản trị viên</option>
              <option value="doctor">Bác sĩ</option>
              <option value="patient">Bệnh nhân</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Trạng thái:</span>
            <select 
              className="form-control" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ minWidth: '130px', padding: '6px 12px', height: '36px' }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Tạm ngưng</option>
            </select>
          </div>

        </div>
      </div>

      {isLoading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Loader2 className="beat-animated" size={36} style={{ margin: '0 auto 1rem', color: 'var(--color-primary)' }} />
          <p>Đang tải danh sách tài khoản...</p>
        </div>
      ) : error ? (
        <div className="alert-strip high" style={{ marginBottom: '1.5rem' }}>
          <div className="alert-strip-body">
            <div className="alert-strip-title">Lỗi hệ thống</div>
            <div className="alert-strip-desc">{error}</div>
            <button className="btn btn-secondary" onClick={() => fetchUsers(true)} style={{ marginTop: '1rem', width: 'fit-content' }}>
              Thử lại
            </button>
          </div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="panel" style={{ textAlign: 'center', padding: '5rem 2rem', color: 'var(--text-muted)' }}>
          <User size={48} style={{ opacity: 0.3, marginBottom: '1.5rem' }} />
          <h3>Không tìm thấy kết quả phù hợp</h3>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' 
              ? 'Không có tài khoản nào khớp với bộ lọc và từ khóa hiện tại.' 
              : 'Hệ thống chưa ghi nhận bất kỳ tài khoản người dùng nào.'}
          </p>
          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
            <button 
              className="btn btn-secondary" 
              onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); }} 
              style={{ marginTop: '1.5rem' }}
            >
              Đặt lại bộ lọc
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
                  <th style={{ padding: '16px' }}>Liên hệ</th>
                  <th style={{ padding: '16px' }}>Vai trò</th>
                  <th style={{ padding: '16px' }}>Ngày tạo</th>
                  <th style={{ padding: '16px' }}>Trạng thái</th>
                  <th style={{ padding: '16px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userAcc) => (
                  <tr key={userAcc.id} style={{ borderBottom: '1px solid var(--glass-border)' }} className="table-row-hover">
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div 
                          className="patient-avatar" 
                          style={{ 
                            background: userAcc.role === 'admin' 
                              ? 'rgba(239, 68, 68, 0.15)' 
                              : userAcc.role === 'doctor' 
                                ? 'var(--color-spo2-glow)' 
                                : 'rgba(59, 130, 246, 0.15)', 
                            color: userAcc.role === 'admin' 
                              ? '#ef4444' 
                              : userAcc.role === 'doctor' 
                                ? 'var(--color-spo2)' 
                                : '#3b82f6',
                            fontWeight: 700
                          }}
                        >
                          {userAcc.full_name ? userAcc.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{userAcc.full_name}</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            ID: {userAcc.id.slice(0, 8)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                          <Mail size={12} style={{ color: 'var(--text-muted)' }} /> {userAcc.email}
                        </span>
                        {userAcc.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                            <Phone size={12} style={{ color: 'var(--text-muted)' }} /> {userAcc.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '16px' }}>
                      <span 
                        style={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.75rem', 
                          fontWeight: 600,
                          ...getRoleBadgeStyle(userAcc.role) 
                        }}
                      >
                        {userAcc.role === 'admin' ? (
                          <Shield size={10} />
                        ) : userAcc.role === 'doctor' ? (
                          <Activity size={10} />
                        ) : (
                          <User size={10} />
                        )}
                        {getRoleLabel(userAcc.role)}
                      </span>
                    </td>

                    <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
                        {formatDate(userAcc.created_at)}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {formatRelativeCreatedAt(userAcc.created_at, now)}
                      </div>
                    </td>

                    <td style={{ padding: '16px' }}>
                      <span className={`patient-status ${userAcc.status === 'active' ? 'normal' : 'critical'}`} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                        {userAcc.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>

                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', height: 'auto', fontSize: '0.8rem' }}
                          onClick={() => handleOpenEditModal(userAcc)}
                        >
                          <Edit2 size={12} /> Sửa
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ 
                            padding: '6px 12px', 
                            height: 'auto', 
                            fontSize: '0.8rem',
                            background: 'linear-gradient(135deg, var(--color-critical), #c2003c)'
                          }}
                          onClick={() => handleOpenDeleteConfirm(userAcc)}
                          disabled={userAcc.id === user?.id}
                          title={userAcc.id === user?.id ? 'Không thể tự xóa tài khoản đang đăng nhập' : undefined}
                        >
                          <Trash2 size={12} /> Xóa
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
              <Plus size={22} style={{ color: 'var(--color-primary)' }} /> Thêm Tài Khoản Mới
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
                  placeholder="Ví dụ: Nguyễn Văn A"
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
                    placeholder="example@gmail.com"
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
                    placeholder="Ví dụ: 0912345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label>Vai trò *</label>
                  <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)} required>
                    <option value="patient">Bệnh nhân (Patient)</option>
                    <option value="doctor">Bác sĩ (Doctor)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Trạng thái hoạt động</label>
                  <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Hoạt động (Active)</option>
                    <option value="inactive">Tạm ngưng / Khóa (Inactive)</option>
                  </select>
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
                    'Tạo tài khoản'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content panel" style={{ maxWidth: '550px' }}>
            <button
              onClick={() => setShowEditModal(false)}
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            <h2 className="auth-title" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Edit2 size={22} style={{ color: 'var(--color-primary)' }} /> Sửa Thông Tin Tài Khoản
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
                  <label>Vai trò *</label>
                  <select className="form-control" value={role} onChange={(e) => setRole(e.target.value)} required>
                    <option value="patient">Bệnh nhân (Patient)</option>
                    <option value="doctor">Bác sĩ (Doctor)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Trạng thái hoạt động</label>
                  <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="active">Hoạt động (Active)</option>
                    <option value="inactive">Tạm khóa / Dừng (Inactive)</option>
                  </select>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '1.5rem', paddingTop: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Lock size={14} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Thay đổi mật khẩu</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Để trống 2 ô dưới nếu bạn không muốn đặt lại mật khẩu cho người dùng này.
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
                    <label>Xác nhận mật khẩu</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Nhập lại mật khẩu mới"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
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

      {showDeleteConfirm && selectedUser && (
        <div className="modal-overlay">
          <div className="modal-content panel" style={{ maxWidth: '460px', textAlign: 'center' }}>
            <div style={{ margin: '0 auto 1rem', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertOctagon size={28} style={{ color: 'var(--color-critical)' }} />
            </div>

            <h2 className="auth-title" style={{ marginBottom: '0.75rem', color: 'var(--color-critical)' }}>
              Xác nhận xóa tài khoản
            </h2>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '2rem' }}>
              Bạn có chắc chắn muốn xóa tài khoản của <strong>{selectedUser.full_name}</strong> ({selectedUser.email})?
              Tài khoản sẽ bị xóa khỏi hệ thống và không thể đăng nhập, nhưng dữ liệu hồ sơ lâm sàng được lưu trữ ẩn để phục vụ audit.
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
                    <Loader2 className="beat-animated" size={16} /> Đang xử lý...
                  </>
                ) : (
                  'Xóa tài khoản'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManager;
