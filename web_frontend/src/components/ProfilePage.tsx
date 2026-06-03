/**
 * @purpose Trang hồ sơ cá nhân để xem/chỉnh sửa thông tin tài khoản người dùng,
 *          hồ sơ bệnh nhân và đổi mật khẩu.
 * @workflow Tải /auth/me và /patients/me khi mount; quản lý ba biểu mẫu (tài khoản,
 *           bệnh nhân, mật khẩu) với xác thực phía máy khách; gửi yêu cầu PUT để
 *           cập nhật dữ liệu.
 * @relationships Sử dụng AuthContext để lấy accessToken; Gọi refreshUser sau các thay đổi;
 *                Sử dụng passwordPolicy util để kiểm tra độ mạnh mật khẩu.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, Save, ShieldCheck, UserRound } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';
import { roleLabel, type UserRole } from '../auth/roles';
import { isStrongPassword, passwordPolicyMessage } from '../utils/passwordPolicy';

interface ProfilePageProps {
  role: UserRole;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  created_at?: string | null;
  status?: string | null;
}

interface PatientProfile {
  id?: string;
  full_name?: string | null;
  age?: number | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  medical_history?: string | null;
  created_at?: string | null;
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

    } catch (e) {

      throw new Error("Lỗi định dạng phản hồi từ server");

    }
    if (Array.isArray(data.detail)) return data.detail.map((item: any) => item.msg).join(', ');
    return data.detail || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Component ProfilePage — quản lý thông tin tài khoản, hồ sơ bệnh nhân và biểu mẫu
 * đổi mật khẩu. Hiển thị có điều kiện phần bệnh nhân chỉ khi role === 'patient'.
 */
export const ProfilePage: React.FC<ProfilePageProps> = ({ role }) => {
  const { accessToken, refreshUser } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [patientProfile, setPatientProfile] = useState<PatientProfile | null>(null);
  const [accountForm, setAccountForm] = useState({ full_name: '', phone: '' });
  const [patientForm, setPatientForm] = useState({
    full_name: '',
    phone: '',
    address: '',
    gender: '',
    age: '',
    medical_history: '',
  });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  }), [accessToken]);

  const hydrateForms = (userData: UserProfile, patientData: PatientProfile | null) => {
    setAccountForm({
      full_name: userData.full_name || '',
      phone: userData.phone || '',
    });
    setPatientForm({
      full_name: patientData?.full_name || userData.full_name || '',
      phone: patientData?.phone || userData.phone || '',
      address: patientData?.address || '',
      gender: patientData?.gender || '',
      age: patientData?.age === null || patientData?.age === undefined ? '' : String(patientData.age),
      medical_history: patientData?.medical_history || '',
    });
  };

  const fetchProfile = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const meResponse = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meResponse.ok) throw new Error(await getErrorMessage(meResponse, 'Không lấy được hồ sơ tài khoản'));
      const meData = await meResponse.json();
      const loadedUser = meData.user as UserProfile;

      let loadedPatient: PatientProfile | null = null;
      if (loadedUser.role === 'patient') {
        const patientResponse = await fetch(`${API_URL}/patients/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!patientResponse.ok) throw new Error(await getErrorMessage(patientResponse, 'Không lấy được hồ sơ bệnh nhân'));
        const patientData = await patientResponse.json();
        loadedPatient = patientData.patient || null;
      }

      setUserProfile(loadedUser);
      setPatientProfile(loadedPatient);
      hydrateForms(loadedUser, loadedPatient);
    } catch (err: any) {
      setError(err.message || 'Không thể tải hồ sơ cá nhân');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [accessToken]);

  const validateAccount = () => {
    if (accountForm.full_name.trim().split(/\s+/).length < 2) return 'Họ và tên cần ít nhất 2 từ.';
    if (accountForm.phone.trim() && !phonePattern.test(accountForm.phone.trim())) return 'Số điện thoại không hợp lệ.';
    return null;
  };

  const validatePatient = () => {
    if (patientForm.full_name.trim().split(/\s+/).length < 2) return 'Họ và tên bệnh nhân cần ít nhất 2 từ.';
    if (patientForm.phone.trim() && !phonePattern.test(patientForm.phone.trim())) return 'Số điện thoại bệnh nhân không hợp lệ.';
    if (patientForm.age.trim()) {
      const age = Number(patientForm.age);
      if (!Number.isInteger(age) || age < 0 || age > 130) return 'Tuổi phải là số nguyên từ 0 đến 130.';
    }
    return null;
  };

  const validatePassword = () => {
    if (!passwordForm.current_password) return 'Vui lòng nhập mật khẩu hiện tại.';
    if (!isStrongPassword(passwordForm.new_password)) return passwordPolicyMessage;
    if (passwordForm.new_password !== passwordForm.confirm_password) return 'Xác nhận mật khẩu không khớp.';
    return null;
  };

  const saveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateAccount();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSavingAccount(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          full_name: accountForm.full_name.trim(),
          phone: accountForm.phone.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Không cập nhật được tài khoản'));
      await refreshUser();
      await fetchProfile();
      setSuccess('Đã lưu thông tin tài khoản.');
    } catch (err: any) {
      setError(err.message || 'Không cập nhật được tài khoản');
    } finally {
      setSavingAccount(false);
    }
  };

  const savePatient = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePatient();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSavingPatient(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${API_URL}/patients/me`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          full_name: patientForm.full_name.trim(),
          phone: patientForm.phone.trim() || null,
          address: patientForm.address.trim() || null,
          gender: patientForm.gender || null,
          age: patientForm.age.trim() ? Number(patientForm.age) : null,
          medical_history: patientForm.medical_history.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await getErrorMessage(response, 'Không cập nhật được hồ sơ bệnh nhân'));
      await fetchProfile();
      setSuccess('Đã lưu hồ sơ bệnh nhân.');
    } catch (err: any) {
      setError(err.message || 'Không cập nhật được hồ sơ bệnh nhân');
    } finally {
      setSavingPatient(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSavingPassword(true);
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
      setSuccess('Đã đổi mật khẩu thành công.');
    } catch (err: any) {
      setError(err.message || 'Không đổi được mật khẩu');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading panel">
        <Loader2 className="profile-spin" size={22} />
        <span>Đang tải hồ sơ cá nhân...</span>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="panel profile-empty">
        <AlertTriangle size={22} />
        <div>
          <h2>Không có dữ liệu hồ sơ</h2>
          <p>Không tìm thấy thông tin tài khoản cho phiên đăng nhập hiện tại.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Hồ sơ cá nhân</h1>
          <p className="page-subtitle">Quản lý thông tin tài khoản, hồ sơ bệnh nhân và bảo mật đăng nhập.</p>
        </div>
      </div>

      {error && (
        <div className="alert-strip high">
          <AlertTriangle size={16} className="alert-strip-icon" />
          <div className="alert-strip-body">
            <div className="alert-strip-title">Có lỗi xảy ra</div>
            <div className="alert-strip-desc">{error}</div>
          </div>
        </div>
      )}
      {success && (
        <div className="alert-strip profile-success">
          <CheckCircle2 size={16} className="alert-strip-icon" />
          <div className="alert-strip-body">
            <div className="alert-strip-title">Thành công</div>
            <div className="alert-strip-desc">{success}</div>
          </div>
        </div>
      )}

      <section className="panel profile-identity">
        <div className="profile-avatar">{userProfile.full_name.charAt(0).toUpperCase()}</div>
        <div className="profile-identity-main">
          <div className="profile-name">{userProfile.full_name}</div>
          <div className="profile-email">{userProfile.email}</div>
          <div className="profile-chip-row">
            <span className="badge"><ShieldCheck size={12} /> {roleLabel[userProfile.role]}</span>
            <span className="badge">Tạo: {formatDate(userProfile.created_at)}</span>
            <span className="badge">Trạng thái: {userProfile.status || 'Chưa có dữ liệu'}</span>
          </div>
        </div>
      </section>

      <div className="profile-grid">
        <form className="panel profile-form" onSubmit={saveAccount}>
          <h2><UserRound size={18} /> Thông tin tài khoản</h2>
          <div className="form-group">
            <label>Họ và tên</label>
            <input className="form-control" value={accountForm.full_name} onChange={(event) => setAccountForm((prev) => ({ ...prev, full_name: event.target.value }))} />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input className="form-control" value={userProfile.email} disabled />
          </div>
          <div className="form-group">
            <label>Số điện thoại</label>
            <input className="form-control" value={accountForm.phone} onChange={(event) => setAccountForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="0901234567" />
          </div>
          <div className="profile-meta-list">
            <span>Vai trò: {roleLabel[userProfile.role]}</span>
            <span>Ngày tạo: {formatDate(userProfile.created_at)}</span>
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingAccount}>
            {savingAccount ? <Loader2 className="profile-spin" size={16} /> : <Save size={16} />} Lưu thay đổi
          </button>
        </form>

        <form className="panel profile-form" onSubmit={changePassword}>
          <h2><KeyRound size={18} /> Đổi mật khẩu</h2>
          <div className="form-group">
            <label>Mật khẩu hiện tại</label>
            <input type="password" className="form-control" value={passwordForm.current_password} onChange={(event) => setPasswordForm((prev) => ({ ...prev, current_password: event.target.value }))} />
          </div>
          <div className="form-group">
            <label>Mật khẩu mới</label>
            <input type="password" className="form-control" value={passwordForm.new_password} onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))} />
          </div>
          <div className="form-group">
            <label>Xác nhận mật khẩu mới</label>
            <input type="password" className="form-control" value={passwordForm.confirm_password} onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPassword}>
            {savingPassword ? <Loader2 className="profile-spin" size={16} /> : <Save size={16} />} Đổi mật khẩu
          </button>
        </form>
      </div>

      {role === 'patient' && (
        <form className="panel profile-form profile-patient-form" onSubmit={savePatient}>
          <h2><UserRound size={18} /> Hồ sơ bệnh nhân</h2>
          {!patientProfile && (
            <div className="profile-empty-inline">
              Chưa có hồ sơ bệnh nhân liên kết. Nhập thông tin và bấm lưu để tạo hồ sơ thật trong bảng patients.
            </div>
          )}
          <div className="profile-form-grid">
            <div className="form-group">
              <label>Họ và tên</label>
              <input className="form-control" value={patientForm.full_name} onChange={(event) => setPatientForm((prev) => ({ ...prev, full_name: event.target.value }))} />
            </div>
            <div className="form-group">
              <label>Số điện thoại</label>
              <input className="form-control" value={patientForm.phone} onChange={(event) => setPatientForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </div>
            <div className="form-group">
              <label>Giới tính</label>
              <select className="form-control" value={patientForm.gender} onChange={(event) => setPatientForm((prev) => ({ ...prev, gender: event.target.value }))}>
                <option value="">Chưa cập nhật</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div className="form-group">
              <label>Tuổi</label>
              <input type="number" min="0" max="130" className="form-control" value={patientForm.age} onChange={(event) => setPatientForm((prev) => ({ ...prev, age: event.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Địa chỉ</label>
            <input className="form-control" value={patientForm.address} onChange={(event) => setPatientForm((prev) => ({ ...prev, address: event.target.value }))} />
          </div>
          <div className="form-group">
            <label>Tiền sử bệnh lý</label>
            <textarea className="form-control" rows={4} value={patientForm.medical_history} onChange={(event) => setPatientForm((prev) => ({ ...prev, medical_history: event.target.value }))} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPatient}>
            {savingPatient ? <Loader2 className="profile-spin" size={16} /> : <Save size={16} />} Lưu hồ sơ bệnh nhân
          </button>
        </form>
      )}
    </div>
  );
};
