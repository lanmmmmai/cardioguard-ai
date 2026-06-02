import React, { useEffect, useMemo, useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  KeyRound, 
  Loader2, 
  Save, 
  UserRound, 
  Camera, 
  User, 
  Heart, 
  FileText, 
  HeartHandshake,
  ShieldAlert,
  Award
} from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';
import { roleLabel, type UserRole } from '../auth/roles';
import { isStrongPassword, passwordPolicyMessage } from '../utils/passwordPolicy';

interface ProfilePageProps {
  role: UserRole;
}

const emptyPasswordForm = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

const phonePattern = /^[0-9+() .-]{7,20}$/;

const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có dữ liệu' : date.toLocaleDateString('vi-VN');
};

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Lỗi định dạng phản hồi từ server");
    }
    if (Array.isArray(data.detail)) return data.detail.map((item: any) => item.msg).join(', ');
    return data.detail || fallback;
  } catch {
    return fallback;
  }
};

export const ProfilePage: React.FC<ProfilePageProps> = ({ role }) => {
  const { accessToken, user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'password'>('account');
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Forms
  const [accountForm, setAccountForm] = useState({ full_name: '', phone: '', avatar_url: '' });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);

  // Patient Profile State
  const [patientForm, setPatientForm] = useState({
    full_name: '',
    phone: '',
    gender: '',
    date_of_birth: '',
    address: '',
    blood_type: '',
    medical_history: '',
    allergies: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    avatar_url: '',
  });

  // Doctor Profile State
  const [doctorForm, setDoctorForm] = useState({
    full_name: '',
    gender: '',
    date_of_birth: '',
    phone: '',
    address: '',
    specialty: '',
    position: '',
    workplace: '',
    experience_years: '' as number | '',
    license_number: '',
    license_issued_date: '',
    license_issued_by: '',
    license_certificate_url: '',
    cccd_front_url: '',
    cccd_back_url: '',
    avatar_url: '',
  });

  const [verificationStatus, setVerificationStatus] = useState({
    status: '',
    is_verified: false,
    verification_note: '',
  });

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  }), [accessToken]);

  const fetchProfileData = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Fetch general account details
      const meResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meResponse.ok) throw new Error(await getErrorMessage(meResponse, 'Không tải được hồ sơ tài khoản'));
      const meData = await meResponse.json();
      const loadedUser = meData.user;
      
      setAccountForm({
        full_name: loadedUser.full_name || '',
        phone: loadedUser.phone || '',
        avatar_url: loadedUser.avatar_url || '',
      });

      // 2. Fetch role-specific profiles
      if (role === 'patient') {
        const pResponse = await fetch(`${API_URL}/patient/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (pResponse.ok) {
          const pData = await pResponse.json();
          setPatientForm({
            full_name: pData.full_name || loadedUser.full_name || '',
            phone: pData.phone || loadedUser.phone || '',
            gender: pData.gender || '',
            date_of_birth: pData.date_of_birth || '',
            address: pData.address || '',
            blood_type: pData.blood_type || '',
            medical_history: pData.medical_history || '',
            allergies: pData.allergies || '',
            emergency_contact_name: pData.emergency_contact_name || '',
            emergency_contact_phone: pData.emergency_contact_phone || '',
            avatar_url: pData.avatar_url || loadedUser.avatar_url || '',
          });
        }
      } else if (role === 'doctor') {
        const dResponse = await fetch(`${API_URL}/doctor/profile`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (dResponse.ok) {
          const dData = await dResponse.json();
          setDoctorForm({
            full_name: dData.full_name || loadedUser.full_name || '',
            gender: dData.gender || '',
            date_of_birth: dData.date_of_birth || '',
            phone: dData.phone || loadedUser.phone || '',
            address: dData.address || '',
            specialty: dData.specialty || '',
            position: dData.position || '',
            workplace: dData.workplace || '',
            experience_years: dData.experience_years !== null && dData.experience_years !== undefined ? dData.experience_years : '',
            license_number: dData.license_number || '',
            license_issued_date: dData.license_issued_date || '',
            license_issued_by: dData.license_issued_by || '',
            license_certificate_url: dData.license_certificate_url || '',
            cccd_front_url: dData.cccd_front_url || '',
            cccd_back_url: dData.cccd_back_url || '',
            avatar_url: dData.avatar_url || loadedUser.avatar_url || '',
          });
        }

        // Fetch verification note
        const vResponse = await fetch(`${API_URL}/doctor/verification-status`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (vResponse.ok) {
          const vData = await vResponse.json();
          setVerificationStatus(vData);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối khi tải hồ sơ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [accessToken, role]);

  // Handle avatar & file uploads
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fileType: 'avatar' | 'doctor_license' | 'cccd_front' | 'cccd_back'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Kích thước tệp tin tối đa là 5MB');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('Chỉ chấp nhận các định dạng ảnh: JPG, JPEG, PNG, WEBP');
      return;
    }

    setError(null);
    setSuccess(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);

    try {
      const response = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Lỗi tải tệp lên.');
      }

      const resData = await response.json();
      
      // Update local state based on what was uploaded
      if (fileType === 'avatar') {
        if (role === 'patient') {
          setPatientForm(prev => ({ ...prev, avatar_url: resData.url }));
        } else if (role === 'doctor') {
          setDoctorForm(prev => ({ ...prev, avatar_url: resData.url }));
        } else if (role === 'admin') {
          setAccountForm(prev => ({ ...prev, avatar_url: resData.url }));
        }
        setSuccess('Tải ảnh đại diện mới thành công! Nhấp lưu để hoàn tất thay đổi.');
      } else if (fileType === 'doctor_license') {
        setDoctorForm(prev => ({ ...prev, license_certificate_url: resData.url }));
        setSuccess('Cập nhật ảnh chứng chỉ thành công!');
      } else if (fileType === 'cccd_front') {
        setDoctorForm(prev => ({ ...prev, cccd_front_url: resData.url }));
        setSuccess('Cập nhật CCCD mặt trước thành công!');
      } else if (fileType === 'cccd_back') {
        setDoctorForm(prev => ({ ...prev, cccd_back_url: resData.url }));
        setSuccess('Cập nhật CCCD mặt sau thành công!');
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải tài liệu lên.');
    } finally {
      setUploading(false);
    }
  };

  // 1. Save general Account settings
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (accountForm.full_name.trim().split(/\s+/).length < 2) {
      setError('Họ và tên cần ít nhất 2 từ.');
      return;
    }
    if (accountForm.phone.trim() && !phonePattern.test(accountForm.phone.trim())) {
      setError('Số điện thoại không hợp lệ.');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          full_name: accountForm.full_name.trim(),
          phone: accountForm.phone.trim() || null,
          avatar_url: accountForm.avatar_url || null,
        }),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response, 'Không cập nhật được tài khoản'));
      await refreshUser();
      setSuccess('Cập nhật thông tin tài khoản thành công.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Không cập nhật được tài khoản');
    } finally {
      setSaving(false);
    }
  };

  // 2. Save Patient Profile
  const handleSavePatientProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientForm.full_name.trim()) return setError('Vui lòng điền họ và tên');
    if (!patientForm.phone.trim()) return setError('Vui lòng điền số điện thoại');
    if (!patientForm.date_of_birth) return setError('Vui lòng chọn ngày sinh');
    if (!patientForm.gender) return setError('Vui lòng chọn giới tính');
    if (!patientForm.address.trim()) return setError('Vui lòng điền địa chỉ liên hệ');

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/patient/profile`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(patientForm),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response, 'Không lưu được hồ sơ bệnh nhân'));
      await refreshUser();
      await fetchProfileData();
      setSuccess('Cập nhật hồ sơ bệnh nhân thành công.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi cập nhật hồ sơ bệnh nhân');
    } finally {
      setSaving(false);
    }
  };

  // 3. Save Doctor Profile
  const handleSaveDoctorProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorForm.full_name.trim()) return setError('Vui lòng điền họ và tên');
    if (!doctorForm.phone.trim()) return setError('Vui lòng điền số điện thoại');
    if (!doctorForm.address.trim()) return setError('Vui lòng điền địa chỉ');
    if (!doctorForm.specialty.trim()) return setError('Vui lòng điền chuyên khoa');
    if (!doctorForm.license_number.trim()) return setError('Vui lòng điền số chứng chỉ hành nghề');
    if (!doctorForm.license_certificate_url) return setError('Vui lòng tải lên ảnh chứng chỉ hành nghề');
    if (!doctorForm.cccd_front_url) return setError('Vui lòng tải lên ảnh CCCD mặt trước');
    if (!doctorForm.cccd_back_url) return setError('Vui lòng tải lên ảnh CCCD mặt sau');

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      ...doctorForm,
      experience_years: doctorForm.experience_years === '' ? null : Number(doctorForm.experience_years),
    };

    try {
      const response = await fetch(`${API_URL}/doctor/profile`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response, 'Không lưu được hồ sơ bác sĩ'));
      await refreshUser();
      await fetchProfileData();
      setSuccess('Gửi hồ sơ cập nhật thành công! Trạng thái tài khoản đổi về Chờ duyệt.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Lỗi cập nhật hồ sơ bác sĩ');
    } finally {
      setSaving(false);
    }
  };

  // 4. Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.current_password) return setError('Vui lòng nhập mật khẩu hiện tại.');
    if (!isStrongPassword(passwordForm.new_password)) return setError(passwordPolicyMessage);
    if (passwordForm.new_password !== passwordForm.confirm_password) return setError('Xác nhận mật khẩu không khớp.');

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/users/me/password`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(passwordForm),
      });

      if (!response.ok) throw new Error(await getErrorMessage(response, 'Không đổi được mật khẩu'));
      setPasswordForm(emptyPasswordForm);
      await refreshUser();
      setSuccess('Đổi mật khẩu đăng nhập thành công.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Lỗi đổi mật khẩu');
    } finally {
      setSaving(false);
    }
  };

  // Resolve media download URL with token
  const getMediaUrl = (path?: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}?token=${accessToken}`;
  };

  const getAvatarSource = () => {
    const rawUrl = role === 'patient' ? patientForm.avatar_url : (role === 'doctor' ? doctorForm.avatar_url : accountForm.avatar_url);
    if (rawUrl) return getMediaUrl(rawUrl);
    if (user?.avatar_url) return getMediaUrl(user.avatar_url);
    return '';
  };

  if (loading) {
    return (
      <div className="profile-loading panel" style={{ display: 'flex', gap: '12px', padding: '32px', justifyContent: 'center' }}>
        <Loader2 className="profile-spin" size={22} style={{ color: 'var(--color-primary)' }} />
        <span>Đang tải thông tin hồ sơ CardioGuard...</span>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ sơ cá nhân</h1>
          <p className="page-subtitle">Quản lý hồ sơ tim mạch, tài liệu hành nghề và mật khẩu bảo vệ.</p>
        </div>
      </div>

      {error && (
        <div className="alert-message error" style={{ marginBottom: '16px' }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert-message success" style={{ marginBottom: '16px' }}>
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      <div className="profile-layout-container">
        {/* Left column: Summary Card and Tabs Navigation */}
        <div className="profile-sidebar-card">
          <div className="avatar-upload-center" style={{ margin: 0 }}>
            <div className="avatar-preview-box" style={{ width: '100px', height: '100px', borderRadius: '24px' }}>
              {getAvatarSource() ? (
                <img src={getAvatarSource()} alt="Avatar" className="avatar-img" style={{ borderRadius: '22px' }} />
              ) : (
                <div className="avatar-placeholder">
                  <User size={40} className="gray-color" />
                </div>
              )}
              <label htmlFor="avatar-upload" className="avatar-edit-btn" style={{ width: '28px', height: '28px', bottom: '-4px', right: '-4px' }}>
                <Camera size={14} />
                <input 
                  type="file" 
                  id="avatar-upload" 
                  accept=".jpg,.jpeg,.png,.webp" 
                  style={{ display: 'none' }} 
                  onChange={(e) => handleFileUpload(e, 'avatar')}
                  disabled={uploading}
                />
              </label>
            </div>
            {uploading && <span className="avatar-tip" style={{ color: 'var(--color-warning)' }}>Đang tải...</span>}
          </div>

          <div className="profile-sidebar-info">
            <h2 className="profile-sidebar-name">{role === 'patient' ? patientForm.full_name : (role === 'doctor' ? doctorForm.full_name : user?.full_name)}</h2>
            <span className="profile-sidebar-email">{user?.email}</span>
          </div>

          {/* Verification Status info for Doctor */}
          {role === 'doctor' && (
            <div style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', backgroundColor: 'var(--bg-tertiary)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Xác thực tài khoản</span>
              <strong style={{ 
                fontSize: '0.85rem',
                textTransform: 'uppercase', 
                color: verificationStatus.is_verified ? 'var(--color-bp)' : (verificationStatus.status === 'rejected' ? 'var(--color-critical)' : 'var(--color-warning)')
              }}>
                {verificationStatus.is_verified ? 'ĐÃ PHÊ DUYỆT' : (verificationStatus.status === 'rejected' ? 'BỊ TỪ CHỐI' : (verificationStatus.status === 'need_update' ? 'CẦN BỔ SUNG' : 'ĐANG CHỜ DUYỆT'))}
              </strong>
            </div>
          )}

          {/* Tabs Navigation */}
          <div className="profile-navigation-tabs">
            <button 
              type="button" 
              className={`profile-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => { setActiveTab('account'); setError(null); setSuccess(null); }}
            >
              <UserRound size={16} />
              Tài khoản
            </button>
            
            {role !== 'admin' && (
              <button 
                type="button" 
                className={`profile-tab-btn ${activeTab === 'profile' ? 'active' : ''} ${role === 'doctor' ? 'tab-doctor-active' : ''}`}
                onClick={() => { setActiveTab('profile'); setError(null); setSuccess(null); }}
              >
                {role === 'patient' ? <Heart size={16} /> : <FileText size={16} />}
                {role === 'patient' ? 'Hồ sơ sức khỏe' : 'Hồ sơ y khoa'}
              </button>
            )}

            <button 
              type="button" 
              className={`profile-tab-btn ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => { setActiveTab('password'); setError(null); setSuccess(null); }}
            >
              <KeyRound size={16} />
              Đổi mật khẩu
            </button>
          </div>
        </div>

        {/* Right column: Tab Form Contents */}
        <div className="profile-content-area">
          {/* TAB 1: Account info */}
          {activeTab === 'account' && (
            <div>
              <div className="profile-form-header">
                <UserRound size={20} />
                <h2>Thông tin tài khoản</h2>
              </div>
              <form onSubmit={handleSaveAccount} className="profile-form">
                <div className="profile-form-grid">
                  <div className="form-group">
                    <label className="required-field">Họ và tên hiển thị</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={accountForm.full_name} 
                      onChange={(e) => setAccountForm(prev => ({ ...prev, full_name: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại liên hệ</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={accountForm.phone} 
                      onChange={(e) => setAccountForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Nhập số điện thoại liên hệ" 
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Địa chỉ Email đăng nhập</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={user?.email} 
                    disabled 
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email đăng nhập không thể thay đổi để đảm bảo tính an toàn.</span>
                </div>

                <div className="profile-meta-list" style={{ marginTop: '12px' }}>
                  <span>Phân quyền hệ thống: <strong>{roleLabel[role]}</strong></span>
                  <span>Tài khoản khởi tạo từ: {formatDate(user?.created_at)}</span>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: 'fit-content' }} disabled={saving}>
                  {saving ? <Loader2 className="profile-spin" size={16} style={{ marginRight: '6px' }} /> : <Save size={16} style={{ marginRight: '6px' }} />}
                  Lưu tài khoản
                </button>
              </form>
            </div>
          )}

          {/* TAB 2: Medical / Doctor Profiles */}
          {activeTab === 'profile' && role === 'patient' && (
            <div>
              <div className="profile-form-header">
                <Heart size={20} style={{ color: 'var(--color-primary)' }} />
                <h2>Hồ sơ sức khỏe bệnh nhân</h2>
              </div>
              <form onSubmit={handleSavePatientProfile} className="profile-form">
                <div className="profile-form-grid">
                  <div className="form-group">
                    <label className="required-field">Họ và tên bệnh nhân</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={patientForm.full_name} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, full_name: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Số điện thoại liên lạc</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={patientForm.phone} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, phone: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Ngày sinh</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={patientForm.date_of_birth} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Giới tính</label>
                    <select 
                      className="form-control" 
                      value={patientForm.gender} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, gender: e.target.value }))}
                      required
                    >
                      <option value="">-- Chọn giới tính --</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                <div className="profile-form-grid">
                  <div className="form-group">
                    <label className="required-field">Địa chỉ liên hệ</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={patientForm.address} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, address: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Nhóm máu</label>
                    <select 
                      className="form-control" 
                      value={patientForm.blood_type} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, blood_type: e.target.value }))}
                    >
                      <option value="">Không rõ</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="O">O</option>
                      <option value="AB">AB</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Dị ứng thuốc/thức ăn</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={patientForm.allergies} 
                    onChange={(e) => setPatientForm(prev => ({ ...prev, allergies: e.target.value }))}
                    placeholder="Ví dụ: Dị ứng Penicillin, hải sản..." 
                  />
                </div>

                <div className="form-group">
                  <label>Tiền sử bệnh lý của bản thân</label>
                  <textarea 
                    className="form-control" 
                    rows={3} 
                    value={patientForm.medical_history} 
                    onChange={(e) => setPatientForm(prev => ({ ...prev, medical_history: e.target.value }))}
                    placeholder="Bệnh lý nền (tim mạch, huyết áp, tiểu đường, hen suyễn...)" 
                  />
                </div>

                <hr className="divider" />
                <h3 className="section-title" style={{ fontSize: '1rem', marginTop: 0 }}>
                  <HeartHandshake size={16} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
                  Người liên hệ khẩn cấp
                </h3>

                <div className="profile-form-grid">
                  <div className="form-group">
                    <label>Họ tên người liên hệ</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={patientForm.emergency_contact_name} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                      placeholder="Tên người thân" 
                    />
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại khẩn cấp</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={patientForm.emergency_contact_phone} 
                      onChange={(e) => setPatientForm(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                      placeholder="Số điện thoại người thân" 
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', marginTop: '12px' }} disabled={saving}>
                  {saving ? <Loader2 className="profile-spin" size={16} style={{ marginRight: '6px' }} /> : <Save size={16} style={{ marginRight: '6px' }} />}
                  Cập nhật bệnh án
                </button>
              </form>
            </div>
          )}

          {activeTab === 'profile' && role === 'doctor' && (
            <div>
              <div className="profile-form-header doctor-profile-header">
                <FileText size={20} style={{ color: 'var(--color-bp)' }} />
                <h2>Hồ sơ y khoa bác sĩ</h2>
              </div>

              {verificationStatus.status === 'need_update' && (
                <div className="alert-box warning-box" style={{ padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid var(--color-warning)', backgroundColor: 'rgba(245, 158, 11, 0.05)', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
                    <ShieldAlert className="warning-color" size={18} style={{ marginRight: '6px' }} />
                    <strong style={{ color: 'var(--color-warning)', fontSize: '0.85rem' }}>YÊU CẦU BỔ SUNG TỪ ADMIN:</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{verificationStatus.verification_note}</p>
                </div>
              )}

              <div className="alert-box info-box" style={{ padding: '12px 16px', borderRadius: '12px', borderLeft: '4px solid var(--color-info)', backgroundColor: 'rgba(59, 130, 246, 0.05)', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <strong>Lưu ý quan trọng:</strong> Khi thay đổi các thông tin chuyên môn hoặc giấy tờ pháp lý, trạng thái tài khoản của bác sĩ sẽ được chuyển về <strong>Chờ duyệt (Pending)</strong> để Admin xét duyệt lại nhằm đảm bảo tính an toàn chuyên môn lâm sàng.
                </p>
              </div>

              <form onSubmit={handleSaveDoctorProfile} className="profile-form">
                <div className="profile-form-grid">
                  <div className="form-group">
                    <label className="required-field">Họ và tên bác sĩ</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={doctorForm.full_name} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, full_name: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Số điện thoại</label>
                    <input 
                      type="tel" 
                      className="form-control" 
                      value={doctorForm.phone} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, phone: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Ngày sinh</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={doctorForm.date_of_birth} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, date_of_birth: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label>Giới tính</label>
                    <select 
                      className="form-control" 
                      value={doctorForm.gender} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, gender: e.target.value }))}
                    >
                      <option value="">Chưa chọn</option>
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="required-field">Địa chỉ liên hệ</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={doctorForm.address} 
                    onChange={(e) => setDoctorForm(prev => ({ ...prev, address: e.target.value }))}
                    required 
                  />
                </div>

                <hr className="divider" />
                <h3 className="section-title" style={{ fontSize: '1rem', marginTop: 0 }}>
                  <Award size={16} style={{ marginRight: '8px', color: 'var(--color-bp)' }} />
                  Chuyên môn & Đơn vị công tác
                </h3>

                <div className="profile-form-grid">
                  <div className="form-group">
                    <label className="required-field">Chuyên khoa chuyên sâu</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={doctorForm.specialty} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, specialty: e.target.value }))}
                      placeholder="Ví dụ: Tim mạch, Nội khoa..." 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Chức vụ</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={doctorForm.position} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, position: e.target.value }))}
                      placeholder="Ví dụ: Bác sĩ điều trị..." 
                    />
                  </div>
                  <div className="form-group">
                    <label>Nơi công tác</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={doctorForm.workplace} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, workplace: e.target.value }))}
                      placeholder="Tên bệnh viện, phòng khám" 
                    />
                  </div>
                  <div className="form-group">
                    <label>Số năm kinh nghiệm</label>
                    <input 
                      type="number" 
                      min="0" 
                      className="form-control" 
                      value={doctorForm.experience_years} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, experience_years: e.target.value === '' ? '' : Number(e.target.value) }))}
                      placeholder="Số năm kinh nghiệm làm việc" 
                    />
                  </div>
                </div>

                <hr className="divider" />
                <h3 className="section-title" style={{ fontSize: '1rem', marginTop: 0 }}>
                  <FileText size={16} style={{ marginRight: '8px', color: 'var(--color-bp)' }} />
                  Chứng chỉ hành nghề & Hồ sơ pháp lý
                </h3>

                <div className="profile-form-grid">
                  <div className="form-group">
                    <label className="required-field">Số chứng chỉ hành nghề (CCHN)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={doctorForm.license_number} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, license_number: e.target.value }))}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Ngày cấp CCHN</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={doctorForm.license_issued_date} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, license_issued_date: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label>Nơi cấp CCHN</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={doctorForm.license_issued_by} 
                      onChange={(e) => setDoctorForm(prev => ({ ...prev, license_issued_by: e.target.value }))}
                      placeholder="Ví dụ: Bộ Y Tế, Sở Y Tế..." 
                    />
                  </div>
                </div>

                {/* Secure Verification documents upload section */}
                <div style={{ marginTop: '16px' }}>
                  <label className="required-field" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '12px' }}>
                    Tài liệu minh chứng đính kèm
                  </label>
                  <div className="document-upload-grid">
                    {/* License file */}
                    <div className="doc-upload-box">
                      <span className="doc-title required-field">Ảnh Chứng chỉ y khoa</span>
                      <div className="doc-preview-zone">
                        {doctorForm.license_certificate_url ? (
                          <img src={getMediaUrl(doctorForm.license_certificate_url)} alt="License Doc" className="doc-preview-img" />
                        ) : (
                          <div className="doc-placeholder">
                            <FileText size={24} />
                            <span>Chưa có ảnh</span>
                          </div>
                        )}
                        <label className="btn btn-secondary btn-small file-input-label">
                          Đổi ảnh
                          <input 
                            type="file" 
                            accept=".jpg,.jpeg,.png,.webp" 
                            style={{ display: 'none' }} 
                            onChange={(e) => handleFileUpload(e, 'doctor_license')}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>

                    {/* CCCD Front */}
                    <div className="doc-upload-box">
                      <span className="doc-title required-field">CCCD Mặt trước</span>
                      <div className="doc-preview-zone">
                        {doctorForm.cccd_front_url ? (
                          <img src={getMediaUrl(doctorForm.cccd_front_url)} alt="CCCD Front Doc" className="doc-preview-img" />
                        ) : (
                          <div className="doc-placeholder">
                            <User size={24} />
                            <span>Chưa có ảnh</span>
                          </div>
                        )}
                        <label className="btn btn-secondary btn-small file-input-label">
                          Đổi ảnh
                          <input 
                            type="file" 
                            accept=".jpg,.jpeg,.png,.webp" 
                            style={{ display: 'none' }} 
                            onChange={(e) => handleFileUpload(e, 'cccd_front')}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>

                    {/* CCCD Back */}
                    <div className="doc-upload-box">
                      <span className="doc-title required-field">CCCD Mặt sau</span>
                      <div className="doc-preview-zone">
                        {doctorForm.cccd_back_url ? (
                          <img src={getMediaUrl(doctorForm.cccd_back_url)} alt="CCCD Back Doc" className="doc-preview-img" />
                        ) : (
                          <div className="doc-placeholder">
                            <User size={24} />
                            <span>Chưa có ảnh</span>
                          </div>
                        )}
                        <label className="btn btn-secondary btn-small file-input-label">
                          Đổi ảnh
                          <input 
                            type="file" 
                            accept=".jpg,.jpeg,.png,.webp" 
                            style={{ display: 'none' }} 
                            onChange={(e) => handleFileUpload(e, 'cccd_back')}
                            disabled={uploading}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: 'fit-content', marginTop: '16px' }} 
                  disabled={saving || uploading}
                >
                  {saving ? <Loader2 className="profile-spin" size={16} style={{ marginRight: '6px' }} /> : <Save size={16} style={{ marginRight: '6px' }} />}
                  Gửi yêu cầu xét duyệt lại
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: Change Password */}
          {activeTab === 'password' && (
            <div>
              <div className="profile-form-header">
                <KeyRound size={20} />
                <h2>Đổi mật khẩu tài khoản</h2>
              </div>
              <form onSubmit={handleChangePassword} className="profile-form">
                <div className="form-group">
                  <label className="required-field">Mật khẩu hiện tại</label>
                  <input 
                    type="password" 
                    className="form-control" 
                    value={passwordForm.current_password} 
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                    placeholder="Nhập mật khẩu hiện tại" 
                    required 
                  />
                </div>
                <div className="profile-form-grid">
                  <div className="form-group">
                    <label className="required-field">Mật khẩu mới</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={passwordForm.new_password} 
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                      placeholder="Ít nhất 8 ký tự, có số, chữ hoa & ký tự đặc biệt" 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label className="required-field">Xác nhận mật khẩu mới</label>
                    <input 
                      type="password" 
                      className="form-control" 
                      value={passwordForm.confirm_password} 
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                      placeholder="Nhập lại mật khẩu mới để xác thực" 
                      required 
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: 'fit-content', marginTop: '12px' }} disabled={saving}>
                  {saving ? <Loader2 className="profile-spin" size={16} style={{ marginRight: '6px' }} /> : <Save size={16} style={{ marginRight: '6px' }} />}
                  Đổi mật khẩu
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
