/**
 * Tệp: CardioGuard AI – Quản lý Bệnh án Điện tử (EMR) dựa trên vai trò
 * Mục đích: Hiển thị giao diện danh sách, chi tiết, tạo mới và sửa đổi bệnh án điện tử
 *           cho các vai trò: Bác sĩ (Doctor), Bệnh nhân (Patient), và Quản trị viên (Admin).
 * Luồng xử lý: 
 *   - Bác sĩ: Có quyền xem danh sách bệnh án, tạo mới từ mẫu chuyên khoa, lưu nháp (draft),
 *             ký xác nhận (sign), và tạo bản bổ sung sửa đổi (amendment).
 *   - Bệnh nhân: Chỉ xem các bệnh án đã được bác sĩ ký xác nhận (status !== draft).
 *   - Quản trị viên: Xem toàn bộ danh sách và chi tiết bệnh án dưới quyền đọc (read-only) phục vụ mục đích kiểm toán.
 * Quan hệ:
 *   - Tiêu thụ: medicalRecordsService để giao tiếp với backend/Supabase.
 *   - Sử dụng: MedicalRecordForm để hiển thị form nhập liệu/xem chi tiết,
 *               MedicalRecordConfirmSignModal để xác nhận ký số.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, FileText, Filter, Plus, RefreshCw, Search, Shield, Upload } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { MedicalRecordForm } from './MedicalRecordForm';
import { MedicalRecordConfirmSignModal } from './MedicalRecordConfirmSignModal';
import { MedicalRecordStatusBadge } from './MedicalRecordStatusBadge';
import { medicalRecordsService } from '../../services/medicalRecordsService';
import type { MedicalRecordFormState, MedicalRecordRow, MedicalRecordRole, MedicalRecordTemplateKey } from './medicalRecordTypes';
import { templateLabels } from './medicalRecordTypes';

type ToastState = { message: string; tone: 'success' | 'error' | 'info' } | null;

const emptyRecord = (message: string) => (
  <div className="cms-empty-state" style={{ padding: '3rem 1rem' }}>
    {message}
  </div>
);

const toPatientOption = (patient: any) => ({ id: String(patient.id), full_name: patient.full_name || patient.name || 'Bệnh nhân' });

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN');
  } catch {
    return value;
  }
};

const RecordShell: React.FC<{
  title: string;
  subtitle: string;
  onBack?: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, onBack, actions, children }) => (
  <div className="role-page-stack">
    <div className="page-header" style={{ gap: 12, flexWrap: 'wrap' }}>
      <div>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {actions}
        {onBack && (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <ArrowLeft size={16} /> Quay lại
          </button>
        )}
      </div>
    </div>
    {children}
  </div>
);

const RecordListTable: React.FC<{
  rows: MedicalRecordRow[];
  role: MedicalRecordRole;
  onOpen: (id: string) => void;
  onEdit?: (id: string) => void;
}> = ({ rows, role, onOpen, onEdit }) => {
  if (rows.length === 0) return emptyRecord('Không có bệnh án phù hợp.');

  return (
    <div className="cms-table-wrap">
      <table className="cms-table">
        <thead>
          <tr>
            <th>Chẩn đoán</th>
            <th>Bệnh nhân</th>
            <th>Bác sĩ</th>
            <th>Chuyên khoa</th>
            <th>Ngày lập</th>
            <th>Trạng thái</th>
            <th>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.final_diagnosis_summary || row.diagnosis || '—'}</td>
              <td>{row.patient_profile?.full_name || row.patient_id || '—'}</td>
              <td>{row.doctor_profile?.full_name || row.doctor_id || '—'}</td>
              <td>{templateLabels[(row.specialty as MedicalRecordTemplateKey) || 'general'] || row.specialty || '—'}</td>
              <td>{formatDate(row.record_date || row.created_at)}</td>
              <td><MedicalRecordStatusBadge status={row.status} /></td>
              <td>
                <div className="cms-row-actions">
                  <button type="button" onClick={() => onOpen(row.id)}>Xem</button>
                  {role === 'doctor' && onEdit && String(row.status) === 'draft' ? (
                    <button type="button" onClick={() => onEdit(row.id)}>Sửa</button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const useMedicalRecordToast = () => {
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  return { toast, setToast };
};

const renderToast = (toast: ToastState) => {
  if (!toast) return null;
  return <div className={`cms-toast ${toast.tone}`}>{toast.message}</div>;
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

export const DoctorMedicalRecordsPage: React.FC<{
  path: string;
  patients: Array<{ id: string; full_name: string }>;
  navigate: (path: string, replace?: boolean) => void;
}> = ({ path, patients, navigate }) => {
  const { accessToken, user } = useAuth();
  const { toast, setToast } = useMedicalRecordToast();
  const currentUserId = user?.id || '';
  const [records, setRecords] = useState<MedicalRecordRow[]>([]);
  const [assignedPatients, setAssignedPatients] = useState<Array<{ id: string; full_name: string }>>(patients.map(toPatientOption));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordRow | null>(null);
  const [confirmSignOpen, setConfirmSignOpen] = useState(false);

  const recordId = path.split('/').filter(Boolean)[2] || '';
  const isNew = path.endsWith('/new');
  const isEdit = path.endsWith('/edit');

  const loadData = async () => {
    if (!currentUserId) return;
    setLoading(true);
    setError(null);
    try {
      const assignedIds = await medicalRecordsService.getDoctorAssignedPatients({ accessToken, currentUserId }, currentUserId);
      const assigned = patients.filter((patient) => assignedIds.includes(patient.id));
      setAssignedPatients(assigned.length ? assigned.map(toPatientOption) : patients.map(toPatientOption));
      const rows = await medicalRecordsService.getDoctorMedicalRecords({ accessToken, currentUserId }, currentUserId);
      setRecords(rows);
      if (recordId && !isNew) {
        const found = rows.find((row) => row.id === recordId) || await medicalRecordsService.getMedicalRecordById({ accessToken, currentUserId }, recordId);
        setSelectedRecord(found);
      } else {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách bệnh án');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, currentUserId, recordId, path]);

  const filteredRecords = useMemo(() => {
    const q = normalizeSearch(search);
    return records.filter((row) => {
      const matchesSearch =
        !q ||
        [row.chief_complaint, row.symptoms, row.diagnosis, row.final_diagnosis_summary, row.patient_profile?.full_name, row.doctor_profile?.full_name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      const matchesStatus = !statusFilter || String(row.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  const refresh = async () => {
    await loadData();
    setToast({ message: 'Đã làm mới dữ liệu bệnh án', tone: 'info' });
  };

  const openRecord = async (id: string) => {
    const found = records.find((row) => row.id === id) || await medicalRecordsService.getMedicalRecordById({ accessToken, currentUserId }, id);
    setSelectedRecord(found);
    const suffix = found.status === 'draft' ? '/edit' : '';
    navigate(`/doctor/medical-records/${id}${suffix}`);
  };

  const handleSave = async (payload: MedicalRecordFormState) => {
    setSaving(true);
    try {
      if (selectedRecord) {
        await medicalRecordsService.updateMedicalRecord({ accessToken, currentUserId }, selectedRecord.id, payload);
        setToast({ message: 'Đã lưu nháp bệnh án', tone: 'success' });
      } else {
        await medicalRecordsService.createMedicalRecord({ accessToken, currentUserId }, payload);
        setToast({ message: 'Đã tạo bệnh án mới', tone: 'success' });
      }
      await loadData();
      navigate('/doctor/medical-records', true);
      setSelectedRecord(null);
    } catch (err: any) {
      setToast({ message: err.message || 'Không lưu được bệnh án', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!selectedRecord) return;
    setSaving(true);
    try {
      await medicalRecordsService.signMedicalRecord({ accessToken, currentUserId }, selectedRecord.id);
      setToast({ message: 'Đã ký xác nhận bệnh án', tone: 'success' });
      setConfirmSignOpen(false);
      await loadData();
      navigate(`/doctor/medical-records/${selectedRecord.id}`, true);
    } catch (err: any) {
      setToast({ message: err.message || 'Không thể ký bệnh án', tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAmendment = async () => {
    if (!selectedRecord) return;
    try {
      const amended = await medicalRecordsService.createMedicalRecordAmendment({ accessToken, currentUserId }, selectedRecord.id);
      setToast({ message: 'Đã tạo bản bổ sung', tone: 'success' });
      await loadData();
      setSelectedRecord(amended);
      navigate(`/doctor/medical-records/${amended.id}/edit`, true);
    } catch (err: any) {
      setToast({ message: err.message || 'Không thể tạo bản bổ sung', tone: 'error' });
    }
  };

  if (loading) {
    return <div className="route-loading">Đang tải bệnh án...</div>;
  }

  if (isNew) {
    return (
      <RecordShell title="Tạo bệnh án mới" subtitle="Bác sĩ nhập và ký xác nhận bệnh án theo mẫu chuyên khoa." onBack={() => navigate('/doctor/medical-records', true)} actions={<button type="button" className="btn btn-secondary" onClick={refresh}><RefreshCw size={16} /> Làm mới</button>}>
        {renderToast(toast)}
        <MedicalRecordForm
          role="doctor"
          currentUserId={currentUserId}
          assignedPatients={assignedPatients}
          onCancel={() => navigate('/doctor/medical-records', true)}
          onSave={handleSave}
        />
      </RecordShell>
    );
  }

  if (isEdit && selectedRecord) {
    return (
      <RecordShell title="Sửa bệnh án" subtitle="Chỉ bệnh án ở trạng thái draft mới được sửa trực tiếp." onBack={() => navigate(`/doctor/medical-records/${selectedRecord.id}`, true)}>
        {renderToast(toast)}
        <MedicalRecordForm
          role="doctor"
          record={selectedRecord}
          currentUserId={currentUserId}
          assignedPatients={assignedPatients}
          onCancel={() => navigate(`/doctor/medical-records/${selectedRecord.id}`, true)}
          onSave={handleSave}
          onRequestSign={() => setConfirmSignOpen(true)}
          onCreateAmendment={selectedRecord.status === 'signed' || selectedRecord.status === 'locked' ? handleCreateAmendment : undefined}
        />
        <MedicalRecordConfirmSignModal open={confirmSignOpen} onClose={() => setConfirmSignOpen(false)} onConfirm={handleSign} loading={saving} />
      </RecordShell>
    );
  }

  if (recordId && selectedRecord) {
    const locked = ['signed', 'locked', 'amended'].includes(String(selectedRecord.status));
    return (
      <RecordShell
        title="Chi tiết bệnh án"
        subtitle="Xem hồ sơ, trạng thái ký xác nhận và lịch sử cập nhật."
        onBack={() => navigate('/doctor/medical-records', true)}
        actions={locked ? <button type="button" className="btn btn-secondary" onClick={handleCreateAmendment}><Upload size={16} /> Tạo bản bổ sung</button> : <button type="button" className="btn btn-primary" onClick={() => navigate(`/doctor/medical-records/${selectedRecord.id}/edit`, true)}>Sửa</button>}
      >
        {renderToast(toast)}
        {error && <div className="alert-strip high"><div className="alert-strip-body"><div className="alert-strip-desc">{error}</div></div></div>}
        <div className="panel">
          <div className="metric-header">
            <div>
              <h3 className="metric-title"><FileText size={18} /> Hồ sơ #{selectedRecord.id.slice(0, 8)}</h3>
              <p className="role-muted">Ngày lập: {formatDate(selectedRecord.record_date || selectedRecord.created_at)}</p>
            </div>
            <MedicalRecordStatusBadge status={selectedRecord.status} />
          </div>
          <div className="role-stat-grid" style={{ marginTop: 12 }}>
            <div className="role-stat-card"><div className="role-stat-label">Bệnh nhân</div><div className="role-stat-value">{selectedRecord.patient_profile?.full_name || selectedRecord.patient_id || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Bác sĩ</div><div className="role-stat-value">{selectedRecord.doctor_profile?.full_name || selectedRecord.doctor_id || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Chuyên khoa</div><div className="role-stat-value">{templateLabels[(selectedRecord.specialty as MedicalRecordTemplateKey) || 'general'] || selectedRecord.specialty || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Hiển thị cho bệnh nhân</div><div className="role-stat-value">{selectedRecord.is_visible_to_patient ? 'Có' : 'Không'}</div></div>
          </div>
        </div>
        <MedicalRecordForm
          role="doctor"
          record={selectedRecord}
          currentUserId={currentUserId}
          assignedPatients={assignedPatients}
          onCancel={() => navigate('/doctor/medical-records', true)}
          onSave={handleSave}
          onRequestSign={selectedRecord.status === 'draft' ? () => setConfirmSignOpen(true) : undefined}
          onCreateAmendment={locked ? handleCreateAmendment : undefined}
          readOnly={locked}
        />
        <MedicalRecordConfirmSignModal open={confirmSignOpen} onClose={() => setConfirmSignOpen(false)} onConfirm={handleSign} loading={saving} />
      </RecordShell>
    );
  }

  return (
    <RecordShell
      title="Bệnh án điện tử"
      subtitle="Danh sách bệnh án bác sĩ được tạo, ký xác nhận và tạo bản bổ sung."
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={refresh}><RefreshCw size={16} /> Làm mới</button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/doctor/medical-records/new')}><Plus size={16} /> Tạo mới</button>
        </>
      }
    >
      {renderToast(toast)}
      {error && <div className="alert-strip high"><AlertTriangle size={16} className="alert-strip-icon" /><div className="alert-strip-body"><div className="alert-strip-desc">{error}</div></div></div>}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label><Search size={16} /> Tìm kiếm</label>
            <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo bệnh nhân, chẩn đoán, ghi chú..." />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label><Filter size={16} /> Trạng thái</label>
            <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="draft">Draft</option>
              <option value="signed">Signed</option>
              <option value="locked">Locked</option>
              <option value="amended">Amended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </section>
      <RecordListTable rows={filteredRecords} role="doctor" onOpen={openRecord} onEdit={(id) => navigate(`/doctor/medical-records/${id}/edit`)} />
    </RecordShell>
  );
};

export const PatientMedicalRecordsPage: React.FC<{
  path: string;
  navigate: (path: string, replace?: boolean) => void;
}> = ({ path, navigate }) => {
  const { accessToken, user } = useAuth();
  const { toast, setToast } = useMedicalRecordToast();
  const [records, setRecords] = useState<MedicalRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordRow | null>(null);
  const recordId = path.split('/').filter(Boolean)[2] || '';

  const loadData = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const rows = await medicalRecordsService.getPatientMedicalRecords({ accessToken, currentUserId: user.id }, user.id);
      setRecords(rows);
      if (recordId) {
        setSelectedRecord(rows.find((row) => row.id === recordId) || await medicalRecordsService.getMedicalRecordById({ accessToken, currentUserId: user.id }, recordId));
      } else {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Không thể tải bệnh án', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user?.id, path]);

  if (loading) return <div className="route-loading">Đang tải bệnh án...</div>;

  if (recordId && selectedRecord) {
    return (
      <RecordShell
        title="Bệnh án của tôi"
        subtitle="Chỉ hiển thị hồ sơ đã được bác sĩ ký xác nhận."
        onBack={() => navigate('/patient/medical-records', true)}
      >
        {renderToast(toast)}
        <div className="panel">
          <div className="metric-header">
            <div>
              <h3 className="metric-title"><Shield size={18} /> Bệnh án đã ký</h3>
              <p className="role-muted">Bệnh án này được lập bởi bác sĩ và chỉ có giá trị khi đã ký xác nhận.</p>
            </div>
            <MedicalRecordStatusBadge status={selectedRecord.status} />
          </div>
          <div className="role-stat-grid" style={{ marginTop: 12 }}>
            <div className="role-stat-card"><div className="role-stat-label">Lý do khám</div><div className="role-stat-value">{selectedRecord.chief_complaint || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Triệu chứng</div><div className="role-stat-value">{selectedRecord.symptoms || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Chẩn đoán</div><div className="role-stat-value">{selectedRecord.diagnosis || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Ngày khám</div><div className="role-stat-value">{formatDate(selectedRecord.record_date || selectedRecord.created_at)}</div></div>
          </div>
        </div>
        <MedicalRecordForm
          role="patient"
          record={selectedRecord}
          currentUserId={user?.id || ''}
          assignedPatients={[]}
          onCancel={() => navigate('/patient/medical-records', true)}
          onSave={async () => undefined}
          readOnly
        />
      </RecordShell>
    );
  }

  return (
    <RecordShell title="Bệnh án điện tử" subtitle="Danh sách các bệnh án đã ký xác nhận." actions={<button type="button" className="btn btn-secondary" onClick={loadData}><RefreshCw size={16} /> Làm mới</button>}>
      {renderToast(toast)}
      <div className="alert-strip medium" style={{ marginBottom: 16 }}>
        <AlertTriangle size={16} className="alert-strip-icon" />
        <div className="alert-strip-body">
          <div className="alert-strip-title">Thông tin bệnh án</div>
          <div className="alert-strip-desc">Bệnh án này được lập bởi bác sĩ và chỉ có giá trị khi đã ký xác nhận.</div>
        </div>
      </div>
      {records.length === 0 ? emptyRecord('Bạn chưa có bệnh án nào được bác sĩ xác nhận.') : <RecordListTable rows={records} role="patient" onOpen={(id) => navigate(`/patient/medical-records/${id}`)} />}
    </RecordShell>
  );
};

export const AdminMedicalRecordsPage: React.FC<{
  path: string;
  patients: Array<{ id: string; full_name: string }>;
  navigate: (path: string, replace?: boolean) => void;
}> = ({ path, patients, navigate }) => {
  const { accessToken, user } = useAuth();
  const { toast, setToast } = useMedicalRecordToast();
  const [records, setRecords] = useState<MedicalRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecordRow | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const recordId = path.split('/').filter(Boolean)[2] || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const rows = await medicalRecordsService.getAdminMedicalRecords({ accessToken, currentUserId: user?.id || null });
      setRecords(rows);
      if (recordId) {
        setSelectedRecord(rows.find((row) => row.id === recordId) || await medicalRecordsService.getMedicalRecordById({ accessToken, currentUserId: user?.id || null }, recordId));
      } else {
        setSelectedRecord(null);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Không thể tải bệnh án', tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, recordId, path]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    return records.filter((row) => {
      const matchesSearch = !q || [row.chief_complaint, row.diagnosis, row.patient_profile?.full_name, row.doctor_profile?.full_name].filter(Boolean).some((value) => String(value).toLowerCase().includes(q));
      const matchesStatus = !statusFilter || String(row.status) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [records, search, statusFilter]);

  if (loading) return <div className="route-loading">Đang tải bệnh án...</div>;

  if (recordId && selectedRecord) {
    return (
      <RecordShell title="Chi tiết bệnh án" subtitle="Admin chỉ xem và kiểm tra audit log." onBack={() => navigate('/admin/medical-records', true)}>
        {renderToast(toast)}
        <div className="panel">
          <div className="metric-header">
            <div>
              <h3 className="metric-title"><FileText size={18} /> Hồ sơ #{selectedRecord.id.slice(0, 8)}</h3>
              <p className="role-muted">Kiểm tra trạng thái ký xác nhận và phân quyền hiển thị.</p>
            </div>
            <MedicalRecordStatusBadge status={selectedRecord.status} />
          </div>
          <div className="role-stat-grid" style={{ marginTop: 12 }}>
            <div className="role-stat-card"><div className="role-stat-label">Bệnh nhân</div><div className="role-stat-value">{selectedRecord.patient_profile?.full_name || selectedRecord.patient_id || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Bác sĩ</div><div className="role-stat-value">{selectedRecord.doctor_profile?.full_name || selectedRecord.doctor_id || '—'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Hiển thị cho bệnh nhân</div><div className="role-stat-value">{selectedRecord.is_visible_to_patient ? 'Có' : 'Không'}</div></div>
            <div className="role-stat-card"><div className="role-stat-label">Ngày cập nhật</div><div className="role-stat-value">{formatDate(selectedRecord.updated_at || selectedRecord.created_at)}</div></div>
          </div>
        </div>
        <MedicalRecordForm
          role="admin"
          record={selectedRecord}
          currentUserId={user?.id || ''}
          assignedPatients={patients.map(toPatientOption)}
          onCancel={() => navigate('/admin/medical-records', true)}
          onSave={async () => undefined}
          readOnly
        />
      </RecordShell>
    );
  }

  return (
    <RecordShell title="Bệnh án điện tử" subtitle="Admin giám sát toàn bộ bệnh án và audit log." actions={<button type="button" className="btn btn-secondary" onClick={loadData}><RefreshCw size={16} /> Làm mới</button>}>
      {renderToast(toast)}
      <section className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label><Search size={16} /> Tìm kiếm</label>
            <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm bệnh nhân, bác sĩ, chẩn đoán..." />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label><Filter size={16} /> Trạng thái</label>
            <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tất cả</option>
              <option value="draft">Draft</option>
              <option value="signed">Signed</option>
              <option value="locked">Locked</option>
              <option value="amended">Amended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </section>
      <RecordListTable rows={filtered} role="admin" onOpen={(id) => navigate(`/admin/medical-records/${id}`)} />
    </RecordShell>
  );
};
