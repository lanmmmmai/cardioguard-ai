import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useBrowserPath } from '../hooks/useBrowserPath';
import { API_URL } from '../config';
import { getRequestErrorMessage } from '../utils/apiErrors';
import { SecureImage } from '../components/SecureImage';
import { 
  Camera, 
  User, 
  FileText, 
  AlertTriangle, 
  Info, 
  CheckCircle, 
  ShieldAlert,
  Save,
  Loader2,
  Calendar,
  Phone,
  MapPin,
  Award
} from 'lucide-react';

export const DoctorCompleteProfile: React.FC = () => {
  const { accessToken, user, refreshUser } = useAuth();
  const { navigate } = useBrowserPath();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [position, setPosition] = useState('');
  const [workplace, setWorkplace] = useState('');
  const [experienceYears, setExperienceYears] = useState<number | ''>('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseIssuedDate, setLicenseIssuedDate] = useState('');
  const [licenseIssuedBy, setLicenseIssuedBy] = useState('');

  // URLs for Uploaded documents
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [licenseUrl, setLicenseUrl] = useState('');
  const [cccdFrontUrl, setCccdFrontUrl] = useState('');
  const [cccdBackUrl, setCccdBackUrl] = useState('');

  // Admin feedback note
  const [verificationNote, setVerificationNote] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [uploadingCccdFront, setUploadingCccdFront] = useState(false);
  const [uploadingCccdBack, setUploadingCccdBack] = useState(false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch current profile & verification note if any
  useEffect(() => {
    if (!accessToken) return;
    
    // Get profile details
    fetch(`${API_URL}/doctor/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error('Không thể tải thông tin hồ sơ.');
      })
      .then((data) => {
        if (data) {
          if (data.full_name) setFullName(data.full_name);
          if (data.gender) setGender(data.gender);
          if (data.date_of_birth) setDob(data.date_of_birth);
          if (data.phone) setPhone(data.phone);
          if (data.address) setAddress(data.address);
          if (data.specialty) setSpecialty(data.specialty);
          if (data.position) setPosition(data.position);
          if (data.workplace) setWorkplace(data.workplace);
          if (data.experience_years !== null && data.experience_years !== undefined) {
            setExperienceYears(data.experience_years);
          }
          if (data.license_number) setLicenseNumber(data.license_number);
          if (data.license_issued_date) setLicenseIssuedDate(data.license_issued_date);
          if (data.license_issued_by) setLicenseIssuedBy(data.license_issued_by);
          if (data.avatar_url) setAvatarUrl(data.avatar_url);
          if (data.license_certificate_url) setLicenseUrl(data.license_certificate_url);
          if (data.cccd_front_url) setCccdFrontUrl(data.cccd_front_url);
          if (data.cccd_back_url) setCccdBackUrl(data.cccd_back_url);
          if (data.verification_note) setVerificationNote(data.verification_note);
          if (data.status) setCurrentStatus(data.status);
        }
      })
      .catch((err) => console.warn(getRequestErrorMessage(err, 'Không thể tải thông tin hồ sơ.')));
  }, [accessToken]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'doctor_license' | 'cccd_front' | 'cccd_back',
    setUploadingState: (val: boolean) => void,
    setUrlState: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size and file extension
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Kích thước tệp tin tối đa là 5MB');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMsg('Chỉ chấp nhận các định dạng ảnh: JPG, JPEG, PNG, WEBP');
      return;
    }

    setErrorMsg(null);
    setUploadingState(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', type);

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
        throw new Error(errData.detail || 'Lỗi tải tệp lên.');
      }

      const resData = await response.json();
      setUrlState(resData.url);
      setSuccessMsg('Tải tài liệu lên thành công!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(getRequestErrorMessage(err, 'Lỗi tải tài liệu.'));
    } finally {
      setUploadingState(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Form validation
    if (!fullName.trim()) return setErrorMsg('Vui lòng nhập họ và tên');
    if (!phone.trim()) return setErrorMsg('Vui lòng nhập số điện thoại');
    if (!address.trim()) return setErrorMsg('Vui lòng nhập địa chỉ hiện tại');
    if (!specialty.trim()) return setErrorMsg('Vui lòng điền chuyên khoa điều trị');
    if (!licenseNumber.trim()) return setErrorMsg('Vui lòng nhập mã chứng chỉ hành nghề');
    if (!licenseUrl) return setErrorMsg('Vui lòng tải lên ảnh chứng chỉ hành nghề');
    if (!cccdFrontUrl) return setErrorMsg('Vui lòng tải lên ảnh căn cước công dân (Mặt trước)');
    if (!cccdBackUrl) return setErrorMsg('Vui lòng tải lên ảnh căn cước công dân (Mặt sau)');

    setSaving(true);
    const payload = {
      full_name: fullName,
      gender: gender || null,
      date_of_birth: dob || null,
      phone,
      address,
      specialty,
      position: position || null,
      workplace: workplace || null,
      experience_years: experienceYears === '' ? null : Number(experienceYears),
      license_number: licenseNumber,
      license_issued_date: licenseIssuedDate || null,
      license_issued_by: licenseIssuedBy || null,
      license_certificate_url: licenseUrl,
      cccd_front_url: cccdFrontUrl,
      cccd_back_url: cccdBackUrl,
      avatar_url: avatarUrl || null,
    };

    try {
      const res = await fetch(`${API_URL}/doctor/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Lỗi cập nhật hồ sơ bác sĩ.');
      }

      setSuccessMsg('Hồ sơ của bạn đã được gửi thành công! Đang chuyển hướng...');
      await refreshUser();
      setTimeout(() => {
        navigate('/doctor/pending-verification', true);
      }, 1500);
    } catch (err) {
      setErrorMsg(getRequestErrorMessage(err, 'Lỗi lưu thông tin hồ sơ bác sĩ.'));
    } finally {
      setSaving(false);
    }
  };

  const getMediaSrc = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}`;
  };

  return (
    <div className="onboarding-page-container">
      <div className="onboarding-card doctor-card">
        <div className="onboarding-header">
          <div className="icon-wrapper bg-teal-soft">
            <CheckCircle className="teal-color" size={32} style={{ color: 'var(--color-bp)' }} />
          </div>
          <h1>Hoàn thiện hồ sơ bác sĩ</h1>
          <p className="subtitle">
            Cung cấp các thông tin y khoa chuyên môn và giấy tờ xác minh pháp lý để ban quản trị phê duyệt quyền khám chữa bệnh của bạn trên hệ thống CardioGuard AI.
          </p>
        </div>

        {/* Display feedback banner if status is need_update */}
        {currentStatus === 'need_update' && (
          <div className="alert-box warning-box" style={{ margin: '0 0 24px 0', padding: '16px', borderRadius: '12px', borderLeft: '5px solid var(--color-warning)', backgroundColor: 'rgba(245, 158, 11, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <ShieldAlert className="warning-color" size={20} style={{ marginRight: '8px', color: 'var(--color-warning)' }} />
              <strong style={{ color: 'var(--color-warning)', fontSize: '0.9rem' }}>YÊU CẦU BỔ SUNG HỒ SƠ TỪ ADMIN</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {verificationNote || 'Vui lòng chỉnh sửa lại các thông tin hoặc ảnh tài liệu không rõ nét.'}
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="alert-message error" style={{ marginBottom: '24px' }}>
            <AlertTriangle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-message success" style={{ marginBottom: '24px' }}>
            <CheckCircle size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="onboarding-form">
          {/* Avatar Upload */}
          <div className="avatar-upload-center">
            <div className="avatar-preview-box">
              {avatarUrl ? (
                <img src={getMediaSrc(avatarUrl)} alt="Avatar Preview" className="avatar-img" />
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
                  onChange={(e) => handleFileUpload(e, 'avatar', setUploadingAvatar, setAvatarUrl)}
                  style={{ display: 'none' }}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            <p className="avatar-tip">
              {uploadingAvatar ? 'Đang tải ảnh...' : 'Ảnh đại diện bác sĩ (Không bắt buộc)'}
            </p>
          </div>

          <hr className="divider" />

          {/* Section: Thông tin cá nhân bác sĩ */}
          <h3 className="section-title">
            <User size={18} style={{ marginRight: '8px', color: 'var(--color-bp)' }} />
            Thông tin cá nhân bác sĩ
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label className="required-field">
                <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Họ và tên bác sĩ
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Họ và tên đầy đủ"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="required-field">
                <Phone size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Số điện thoại liên lạc
              </label>
              <input
                type="tel"
                className="form-control"
                placeholder="Số điện thoại cá nhân"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>
                <Calendar size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Ngày sinh
              </label>
              <input
                type="date"
                className="form-control"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>
                <User size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                Giới tính
              </label>
              <select
                className="form-control"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
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
              placeholder="Địa chỉ nhà riêng hoặc văn phòng làm việc"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>

          <hr className="divider" />

          {/* Section: Chuyên môn */}
          <h3 className="section-title">
            <Award size={18} style={{ marginRight: '8px', color: 'var(--color-bp)' }} />
            Chuyên môn & Nơi công tác
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label className="required-field">Chuyên khoa chuyên môn</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ví dụ: Tim mạch, Nội khoa, Chẩn đoán hình ảnh..."
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Chức vụ / Vị trí</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ví dụ: Bác sĩ điều trị, Trưởng khoa..."
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Bệnh viện / Nơi công tác hiện tại</label>
              <input
                type="text"
                className="form-control"
                placeholder="Tên bệnh viện hoặc cơ sở y khoa"
                value={workplace}
                onChange={(e) => setWorkplace(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Số năm kinh nghiệm hành nghề</label>
              <input
                type="number"
                min="0"
                className="form-control"
                placeholder="Nhập số năm kinh nghiệm"
                value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          <hr className="divider" />

          {/* Section: Chứng chỉ hành nghề */}
          <h3 className="section-title">
            <FileText size={18} style={{ marginRight: '8px', color: 'var(--color-bp)' }} />
            Chứng chỉ hành nghề y khoa (CCHN)
          </h3>

          <div className="form-grid">
            <div className="form-group">
              <label className="required-field">Số chứng chỉ hành nghề</label>
              <input
                type="text"
                className="form-control"
                placeholder="Mã số chứng chỉ hành nghề"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Ngày cấp chứng chỉ</label>
              <input
                type="date"
                className="form-control"
                value={licenseIssuedDate}
                onChange={(e) => setLicenseIssuedDate(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Cơ quan / Đơn vị cấp chứng chỉ</label>
              <input
                type="text"
                className="form-control"
                placeholder="Ví dụ: Bộ Y Tế, Sở Y Tế Hà Nội..."
                value={licenseIssuedBy}
                onChange={(e) => setLicenseIssuedBy(e.target.value)}
              />
            </div>
          </div>

          <hr className="divider" />

          {/* Section: Tải lên giấy tờ tài liệu chứng minh */}
          <h3 className="section-title">
            <Info size={18} style={{ marginRight: '8px', color: 'var(--color-bp)' }} />
            Tài liệu xác thực hành nghề (Bắt buộc)
          </h3>

          <div className="document-upload-grid">
            {/* 1. Chứng chỉ hành nghề */}
            <div className="doc-upload-box">
               <span className="doc-title required-field">Ảnh chứng chỉ hành nghề</span>
               <div className="doc-preview-zone">
                 {licenseUrl ? (
                   <SecureImage src={getMediaSrc(licenseUrl)} accessToken={accessToken} alt="License Certificate" className="doc-preview-img" />
                 ) : (
                   <div className="doc-placeholder">
                     <FileText size={28} />
                     <span>Chưa tải ảnh lên</span>
                   </div>
                 )}
                 <label className="btn btn-secondary btn-small file-input-label">
                   Tải lên
                   <input
                     type="file"
                     accept=".jpg,.jpeg,.png,.webp"
                     onChange={(e) => handleFileUpload(e, 'doctor_license', setUploadingLicense, setLicenseUrl)}
                     style={{ display: 'none' }}
                     disabled={uploadingLicense}
                   />
                 </label>
               </div>
               {uploadingLicense && <span className="upload-loader">Đang tải lên...</span>}
             </div>
 
             {/* 2. CCCD mặt trước */}
             <div className="doc-upload-box">
               <span className="doc-title required-field">CCCD Mặt trước</span>
               <div className="doc-preview-zone">
                 {cccdFrontUrl ? (
                   <SecureImage src={getMediaSrc(cccdFrontUrl)} accessToken={accessToken} alt="CCCD Front" className="doc-preview-img" />
                 ) : (
                   <div className="doc-placeholder">
                     <User size={28} />
                     <span>Chưa tải ảnh lên</span>
                   </div>
                 )}
                 <label className="btn btn-secondary btn-small file-input-label">
                   Tải lên
                   <input
                     type="file"
                     accept=".jpg,.jpeg,.png,.webp"
                     onChange={(e) => handleFileUpload(e, 'cccd_front', setUploadingCccdFront, setCccdFrontUrl)}
                     style={{ display: 'none' }}
                     disabled={uploadingCccdFront}
                   />
                 </label>
               </div>
               {uploadingCccdFront && <span className="upload-loader">Đang tải lên...</span>}
             </div>
 
             {/* 3. CCCD mặt sau */}
             <div className="doc-upload-box">
               <span className="doc-title required-field">CCCD Mặt sau</span>
               <div className="doc-preview-zone">
                 {cccdBackUrl ? (
                   <SecureImage src={getMediaSrc(cccdBackUrl)} accessToken={accessToken} alt="CCCD Back" className="doc-preview-img" />
                 ) : (
                   <div className="doc-placeholder">
                     <User size={28} />
                     <span>Chưa tải ảnh lên</span>
                   </div>
                 )}
                 <label className="btn btn-secondary btn-small file-input-label">
                   Tải lên
                   <input
                     type="file"
                     accept=".jpg,.jpeg,.png,.webp"
                     onChange={(e) => handleFileUpload(e, 'cccd_back', setUploadingCccdBack, setCccdBackUrl)}
                     style={{ display: 'none' }}
                     disabled={uploadingCccdBack}
                   />
                 </label>
               </div>
               {uploadingCccdBack && <span className="upload-loader">Đang tải lên...</span>}
             </div>
          </div>

          {/* Actions */}
          <div className="onboarding-actions">
            <button
              type="submit"
              className="btn btn-primary btn-large"
              disabled={
                saving || 
                uploadingAvatar || 
                uploadingLicense || 
                uploadingCccdFront || 
                uploadingCccdBack
              }
              style={{ width: '100%', marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {saving ? (
                <>
                  <Loader2 className="profile-spin" size={18} />
                  Đang gửi hồ sơ...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Gửi hồ sơ yêu cầu xác thực
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
