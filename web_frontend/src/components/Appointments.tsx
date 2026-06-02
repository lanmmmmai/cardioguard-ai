import React, { useEffect, useState } from 'react';
import { AlertCircle, Calendar, CalendarDays, CheckCircle2, Clock, Plus, RefreshCw, User, XCircle } from 'lucide-react';
import { API_URL } from '../config';
import { useAuth } from '../auth/AuthContext';

interface Patient {
  id: string;
  full_name: string;
  age: number;
  gender: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  title: string;
  status: string; // 'pending', 'approved', 'cancelled'
  channel: string; // 'online', 'offline'
  scheduled_at: string;
  notes: string;
  created_at: string;
}

interface AppointmentsProps {
  patients: Patient[];
  role: 'patient' | 'doctor' | 'admin';
}

export const Appointments: React.FC<AppointmentsProps> = ({ patients, role }) => {
  const { accessToken, user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mappings
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});

  // Booking Form State
  const [showBookModal, setShowBookModal] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [channel, setChannel] = useState<'online' | 'offline'>('offline');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action Updating States
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);

  // Fetch appointments list
  const fetchAppointments = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/appointments`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let data;

      try {

        data = await response.json();

      } catch (e) {

        throw new Error("Lỗi định dạng phản hồi từ server");

      }
      if (!response.ok) throw new Error(data.detail || 'Không thể lấy dữ liệu lịch hẹn');
      
      const apptList = Array.isArray(data) ? data : [];
      // Sort: Newest scheduled date first
      apptList.sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
      
      // Filter list by role
      const filtered = apptList.filter((appt) => {
        if (role === 'patient') return appt.patient_id === user?.id;
        if (role === 'doctor') return appt.doctor_id === user?.id;
        return true; // Admin views all
      });

      setAppointments(filtered);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối máy chủ khi lấy danh sách lịch hẹn');
    } finally {
      setLoading(false);
    }
  };

  // Fetch doctors list for patient booking & mappings
  const fetchDoctors = async () => {
    try {
      const response = await fetch(`${API_URL}/cms/users?filter=role:doctor&limit=100`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      let data;

      try {

        data = await response.json();

      } catch (e) {

        throw new Error("Lỗi định dạng phản hồi từ server");

      }
      if (response.ok && data.items) {
        setDoctors(data.items);
        const docMap: Record<string, string> = {};
        data.items.forEach((item: any) => {
          docMap[item.id] = item.full_name;
        });
        setDoctorNames(docMap);
      }
    } catch (err) {
      console.error('Failed to fetch doctor mappings:', err);
    }
  };

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, [accessToken, role, user?.id]);

  // Construct patient names mapping whenever patients list changes
  useEffect(() => {
    const pMap: Record<string, string> = {};
    patients.forEach((p) => {
      pMap[p.id] = p.full_name;
    });
    setPatientNames(pMap);
  }, [patients]);

  // Handle Book Appointment Submission (Patient only)
  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!title || !selectedDoctorId || !scheduledAt) {
      alert('Vui lòng điền đầy đủ các thông tin bắt buộc (*).');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          doctor_id: selectedDoctorId,
          title,
          scheduled_at: new Date(scheduledAt).toISOString(),
          notes,
          channel,
        }),
      });

      if (response.ok) {
        setShowBookModal(false);
        setTitle('');
        setSelectedDoctorId('');
        setScheduledAt('');
        setChannel('offline');
        setNotes('');
        await fetchAppointments();
        alert('Gửi yêu cầu đặt lịch hẹn khám thành công!');
      } else {
        let data;

        try {

          data = await response.json();

        } catch (e) {

          throw new Error("Lỗi định dạng phản hồi từ server");

        }
        alert(data.detail || 'Đặt lịch khám thất bại.');
      }
    } catch (err) {
      alert('Lỗi kết nối khi gửi yêu cầu lịch hẹn.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Approval / Cancel Status Updates (Doctor/Admin only)
  const handleUpdateStatus = async (id: string, newStatus: 'approved' | 'cancelled') => {
    if (!accessToken) return;
    setUpdatingIds((prev) => [...prev, id]);

    try {
      const response = await fetch(`${API_URL}/appointments/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        await fetchAppointments();
      } else {
        let data;

        try {

          data = await response.json();

        } catch (e) {

          throw new Error("Lỗi định dạng phản hồi từ server");

        }
        alert(data.detail || 'Cập nhật trạng thái thất bại.');
      }
    } catch (err) {
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setUpdatingIds((prev) => prev.filter((uid) => uid !== id));
    }
  };

  return (
    <div className="role-page-stack">
      <div className="page-header" style={{ gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarDays size={28} /> Quản lý lịch hẹn khám
          </h1>
          <p className="page-subtitle">
            {role === 'patient'
              ? 'Đặt lịch khám trực tuyến hoặc trực tiếp với bác sĩ phụ trách của bạn.'
              : 'Phê duyệt, sắp xếp và quản lý danh sách cuộc hẹn khám của bệnh nhân.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {role === 'patient' && (
            <button type="button" className="btn btn-primary" onClick={() => setShowBookModal(true)}>
              <Plus size={16} /> Đặt lịch hẹn khám
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={fetchAppointments} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'beat-animated' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel" style={{ padding: '3rem 0', textAlign: 'center' }}>
          <RefreshCw size={28} className="beat-animated" style={{ margin: '0 auto 12px', color: 'var(--color-primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Đang đồng bộ danh sách cuộc hẹn khám...</p>
        </div>
      ) : error ? (
        <div className="alert-strip high">
          <AlertCircle size={18} className="alert-strip-icon" />
          <div className="alert-strip-body">
            <div className="alert-strip-title">Lỗi đồng bộ dữ liệu</div>
            <div className="alert-strip-desc">{error}</div>
          </div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="panel" style={{ padding: '4rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Calendar size={48} style={{ margin: '0 auto 16px', strokeWidth: 1.2, opacity: 0.6 }} />
          <h3>Chưa có lịch hẹn khám nào</h3>
          <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>
            {role === 'patient'
              ? 'Hãy nhấp vào nút "Đặt lịch hẹn khám" ở trên để gửi yêu cầu khám.'
              : 'Hiện chưa có yêu cầu cuộc hẹn khám nào từ phía bệnh nhân của bạn.'}
          </p>
        </div>
      ) : (
        <div className="appointments-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {appointments.map((appt) => {
            const isPast = new Date(appt.scheduled_at).getTime() < new Date().getTime();
            const status = appt.status.toLowerCase();
            const isExpired = isPast && (status === 'pending' || status === 'approved');

            let statusLabel = 'ĐANG CHỜ';
            let statusStyles: React.CSSProperties = {
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.2)',
            };

            if (isExpired) {
              statusLabel = 'QUÁ HẠN';
              statusStyles = {
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#f97316',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              };
            } else if (status === 'approved') {
              statusLabel = 'ĐÃ DUYỆT';
              statusStyles = {
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--color-bp)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
              };
            } else if (status === 'cancelled') {
              statusLabel = 'ĐÃ HỦY';
              statusStyles = {
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--color-critical)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              };
            }

            const docName = doctorNames[appt.doctor_id] || 'Bác sĩ chuyên khoa';
            const patName = patientNames[appt.patient_id] || 'Bệnh nhân';
            const isUpdating = updatingIds.includes(appt.id);

            return (
              <div
                className="panel"
                key={appt.id}
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  borderLeft: isExpired
                    ? '4px solid #f97316'
                    : status === 'approved'
                    ? '4px solid var(--color-bp)'
                    : status === 'cancelled'
                    ? '4px solid var(--color-critical)'
                    : '4px solid #f59e0b',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span
                      className="patient-status"
                      style={{
                        display: 'inline-flex',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        ...statusStyles,
                      }}
                    >
                      {statusLabel}
                    </span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: appt.channel === 'online' ? 'rgba(14, 165, 233, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: appt.channel === 'online' ? 'var(--color-spo2)' : '#d97706',
                        border: appt.channel === 'online' ? '1px solid rgba(14, 165, 233, 0.15)' : '1px solid rgba(245, 158, 11, 0.15)',
                      }}
                    >
                      {appt.channel.toUpperCase()}
                    </span>
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Mã hẹn: #{appt.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{appt.title}</h3>
                  {appt.notes && (
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', margin: '4px 0' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '2px' }}>Ghi chú lâm sàng / Lý do:</span>
                      {appt.notes}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} style={{ color: 'var(--color-spo2)' }} />
                    <span className="tabular-nums" style={{ fontWeight: 500 }}>
                      {new Date(appt.scheduled_at).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} style={{ color: 'var(--color-bp)' }} />
                    <span style={{ fontWeight: 600 }}>
                      {role === 'patient' ? `Bác sĩ chuyên khoa: ${docName}` : `Bệnh nhân: ${patName}`}
                    </span>
                  </div>
                </div>

                {/* Actions for Doctor/Admin */}
                {(role === 'doctor' || role === 'admin') && status === 'pending' && !isExpired && (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-critical)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      onClick={() => handleUpdateStatus(appt.id, 'cancelled')}
                      disabled={isUpdating}
                    >
                      <XCircle size={14} /> Từ chối
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'linear-gradient(135deg, var(--color-bp), #059669)', boxShadow: 'none' }}
                      onClick={() => handleUpdateStatus(appt.id, 'approved')}
                      disabled={isUpdating}
                    >
                      <CheckCircle2 size={14} /> Duyệt lịch hẹn
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Form Modal (Patient only) */}
      {showBookModal && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-content panel" style={{ maxWidth: '520px', width: '100%' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 className="auth-title" style={{ margin: 0, fontSize: '1.25rem' }}>Đăng Ký Đặt Lịch Hẹn Khám</h2>
              <button
                type="button"
                className="banner-close-btn"
                onClick={() => setShowBookModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleBookSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Tiêu đề lịch khám *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: Tái khám cao huyết áp định kỳ"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label>Bác sĩ điều trị phụ trách *</label>
                <select
                  className="form-control"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  required
                  disabled={isSubmitting}
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <option value="">-- Chọn Bác sĩ phụ trách khám --</option>
                  {doctors.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.full_name} ({doc.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2-3" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 0 }}>
                <div className="form-group">
                  <label>Thời gian hẹn khám *</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label>Hình thức khám</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="radio"
                        name="channel"
                        checked={channel === 'offline'}
                        onChange={() => setChannel('offline')}
                        disabled={isSubmitting}
                      />
                      Trực tiếp (Offline)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                      <input
                        type="radio"
                        name="channel"
                        checked={channel === 'online'}
                        onChange={() => setChannel('online')}
                        disabled={isSubmitting}
                      />
                      Trực tuyến (Online)
                    </label>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label>Ghi chú lý do / Triệu chứng y khoa</label>
                <textarea
                  className="form-control"
                  placeholder="Hãy mô tả chi tiết lý do khám hoặc các triệu chứng sinh học bất thường gần đây..."
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSubmitting}
                  style={{ resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowBookModal(false)}
                  disabled={isSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Đang gửi...' : 'Xác nhận đăng ký'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Appointments;
