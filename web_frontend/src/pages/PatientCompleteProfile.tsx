import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useBrowserPath } from '../hooks/useBrowserPath';
import { API_URL } from '../config';
import { getRequestErrorMessage } from '../utils/apiErrors';
import { 
  Camera, 
  User, 
  Heart, 
  AlertTriangle, 
  Shield, 
  HeartHandshake, 
  Save, 
  Loader2,
  Calendar,
  Phone,
  MapPin,
  Activity
} from 'lucide-react';

export const PatientCompleteProfile: React.FC = () => {
  const { accessToken, user, refreshUser } = useAuth();
  const { navigate } = useBrowserPath();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [address, setAddress] = useState('');
  const [bloodType, setBloodType] = useState('');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch existing profile if available
  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_URL}/patient/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Không thể tải thông tin hồ sơ.');
      })
      .then((data) => {
        if (data) {
          if (data.full_name) setFullName(data.full_name);
          if (data.phone) setPhone(data.phone);
          if (data.gender) setGender(data.gender);
          if (data.date_of_birth) setDob(data.date_of_birth);
          if (data.address) setAddress(data.address);
          if (data.blood_type) setBloodType(data.blood_type);
          if (data.medical_history) setMedicalHistory(data.medical_history);
          if (data.allergies) setAllergies(data.allergies);
          if (data.emergency_contact_name) setEmergencyName(data.emergency_contact_name);
          if (data.emergency_contact_phone) setEmergencyPhone(data.emergency_contact_phone);
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
        }
      })
      .catch((err) => console.warn(getRequestErrorMessage(err, 'Không thể tải thông tin hồ sơ.')));
  }, [accessToken]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validations
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Kích thước ảnh đại diện tối đa là 5MB');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('Chỉ chấp nhận các định dạng ảnh: JPG, JPEG, PNG, WEBP');
      return;
    }

    setErrorMsg(null);
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', 'avatar');

    try {
      const response = await fetch(`${API_URL}/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Lỗi tải ảnh lên.');
      }

      const resData = await response.json();
      setAvatarUrl(resData.url);
      setSuccessMsg('Tải ảnh đại diện thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(getRequestErrorMessage(err, 'Lỗi kết nối khi tải ảnh.'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validations
    if (!fullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên');
      return;
    }
    if (!dob) {
      setErrorMsg('Vui lòng chọn ngày sinh');
      return;
    }
    if (!gender) {
      setErrorMsg('Vui lòng chọn giới tính');
      return;
    }
    if (!phone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại liên hệ');
      return;
    }
    if (!address.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ hiện tại');
      return;
    }

    setSaving(true);
    const payload = {
      full_name: fullName,
      phone,
      gender,
      date_of_birth: dob,
      address,
      blood_type: bloodType || null,
      medical_history: medicalHistory || null,
      allergies: allergies || null,
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      avatar_url: avatarUrl || null,
    };

    try {
      const res = await fetch(`${API_URL}/patient/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Lỗi lưu hồ sơ bệnh nhân.');
      }

      setSuccessMsg('Lưu hồ sơ thành công! Đang chuyển đến Trang chủ...');
      await refreshUser();
      setTimeout(() => {
        navigate('/patient/dashboard', true);
      }, 1500);
    } catch (err) {
      setErrorMsg(getRequestErrorMessage(err, 'Lỗi lưu trữ thông tin hồ sơ.'));
    } finally {
      setSaving(false);
    }
  };

  // Helper to resolve avatar image path
  const getAvatarSrc = () => {
    if (!avatarUrl) return '';
    if (avatarUrl.startsWith('http')) return avatarUrl;
    return `${API_URL}${avatarUrl}`;
  };

  return (
    <div className="onboarding-page-container">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <div className="icon-wrapper bg-rose-soft">
            <Shield className="rose-color" size={32} />
          </div>
          <h1>Hoàn thiện hồ sơ bệnh nhân</h1>
          <p className="subtitle">
            Cập nhật các thông tin y khoa cơ bản dưới đây để kích hoạt tài khoản CardioGuard AI và bắt đầu theo dõi sức khỏe tim mạch của bạn.
          </p>
        </div>

        {errorMsg && (
          <div className="alert-message error" style={{ marginBottom: '24px' }}>
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-message success" style={{ marginBottom: '24px' }}>
            <Heart size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="onboarding-form">
          {/* Avatar Section */}
          <div className="avatar-upload-center">
            <div className="avatar-preview-box">
              {avatarUrl ? (
                <img src={getAvatarSrc()} alt="Avatar Preview" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">
                  <User size={48} className="gray-color" />
                </div>
              )}
              <label htmlFor="avatar-file" className="avatar-edit-btn">
                <Camera size={16} />
                <input
                  type="file"
                  id="avatar-file"
                  accept=".jpg,.jpeg,.png,.webp"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            </div>
            <p className="avatar-tip">
              {uploading ? 'Đang tải ảnh...' : 'Tải lên ảnh đại diện cá nhân'}
            </p>
          </div>

          <hr className="divider" />

          {/* Section: Thông tin cơ bản */}
          <h3 className="section-title">
            <User size={18} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
            Thông tin bắt buộc
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label className="required-field">
                <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Họ và tên bệnh nhân
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Nhập đầy đủ họ và tên"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="required-field">
                <Phone size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Số điện thoại
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="Số điện thoại liên hệ"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="required-field">
                <Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Ngày sinh
              </label>
              <input
                type="date"
                className="form-control"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="required-field">
                <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Giới tính
              </label>
              <select
                className="form-control"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
              >
                <option value="">-- Chọn giới tính --</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="required-field">
              <MapPin size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Địa chỉ liên hệ
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <hr className="divider" />

          {/* Section: Chỉ số lâm sàng */}
          <h3 className="section-title">
            <Heart size={18} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
            Chỉ số y tế & Tiền sử bệnh
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label>
                <Activity size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Nhóm máu
              </label>
              <select
                className="form-control"
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
              >
                <option value="">Không rõ</option>
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

            <div className="form-group">
              <label>
                <AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Dị ứng thuốc/thức ăn
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Ví dụ: Penicillin, hải sản..."
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Tiền sử bệnh lý (Tim mạch, huyết áp...)</label>
            <textarea
              className="form-control"
              placeholder="Nhập chi tiết các bệnh nền, phẫu thuật trước đây hoặc tình trạng tim mạch hiện tại"
              rows={3}
              value={medicalHistory}
              onChange={(e) => setMedicalHistory(e.target.value)}
            />
          </div>

          <hr className="divider" />

          {/* Section: Liên hệ khẩn cấp */}
          <h3 className="section-title">
            <HeartHandshake size={18} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
            Liên hệ khẩn cấp (Người thân)
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label>
                <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Tên người liên hệ khẩn cấp
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Họ tên người thân"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                <Phone size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                SĐT liên hệ khẩn cấp
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="Số điện thoại người thân"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="onboarding-actions">
            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={saving || uploading}
              style={{ width: '100%', marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {saving ? (
                <>
                  <Loader2 className="profile-spin" size={18} />
                  Đang lưu hồ sơ...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Hoàn tất cập nhật hồ sơ
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
