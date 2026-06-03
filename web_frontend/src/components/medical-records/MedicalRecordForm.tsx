import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, FileText, Save, Sparkles, Upload, UserRound } from 'lucide-react';
import { medicalRecordTemplates } from './medicalRecordTemplates';
import {
  cardiologyExtras,
  makeInitialFormState,
  pulmonologyExtras,
  type MedicalRecordFormState,
  type MedicalRecordRole,
  type MedicalRecordRow,
  type MedicalRecordTemplateKey,
} from './medicalRecordTypes';

const fieldClass = 'form-control';

const joinIfArray = (parts: string[]) => parts.filter(Boolean).join('\n');

const templateOptions: Array<{ key: MedicalRecordTemplateKey; label: string; subtitle: string }> = Object.values(medicalRecordTemplates).map((tpl) => ({
  key: tpl.key,
  label: tpl.label,
  subtitle: tpl.subtitle,
}));

export const MedicalRecordForm: React.FC<{
  role: MedicalRecordRole;
  record?: MedicalRecordRow | null;
  assignedPatients: Array<{ id: string; full_name: string }>;
  currentUserId: string;
  onCancel: () => void;
  onSave: (payload: MedicalRecordFormState) => Promise<void>;
  onRequestSign?: () => void;
  onCreateAmendment?: () => void;
  readOnly?: boolean;
}> = ({ role, record, assignedPatients, currentUserId, onCancel, onSave, onRequestSign, onCreateAmendment, readOnly = false }) => {
  const [form, setForm] = useState<MedicalRecordFormState>(makeInitialFormState());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!record) {
      setForm({ ...makeInitialFormState(), doctor_id: currentUserId });
      return;
    }
    setForm({
      ...makeInitialFormState(),
      patient_id: record.patient_id || '',
      doctor_id: record.doctor_id || currentUserId,
      chief_complaint: record.chief_complaint || '',
      symptoms: record.symptoms || '',
      diagnosis: record.diagnosis || '',
      disease_summary: record.disease_summary || '',
      final_diagnosis_summary: record.final_diagnosis_summary || '',
      treatment_plan: record.treatment_plan || '',
      notes: record.notes || '',
      specialty: (record.specialty as MedicalRecordTemplateKey) || 'general',
      visit_type: record.visit_type || 'outpatient',
      record_date: record.record_date || new Date().toISOString().slice(0, 10),
      status: (record.status as any) || 'draft',
      is_visible_to_patient: Boolean(record.is_visible_to_patient),
      signed_by: record.signed_by || '',
      signed_at: record.signed_at || '',
      locked_at: record.locked_at || '',
    });
  }, [record, currentUserId]);

  const template = useMemo(() => medicalRecordTemplates[form.specialty], [form.specialty]);

  const validate = () => {
    if (!form.patient_id) return 'Chọn bệnh nhân.';
    if (!form.chief_complaint.trim()) return 'Lý do khám/nhập viện là bắt buộc.';
    if (!form.symptoms.trim()) return 'Triệu chứng là bắt buộc.';
    if (!form.diagnosis.trim()) return 'Chẩn đoán là bắt buộc.';
    if (!form.record_date) return 'Ngày lập bệnh án là bắt buộc.';
    return null;
  };

  const syncExtrasIntoNotes = (next: MedicalRecordFormState) => {
    const blocks: string[] = [];
    if (next.specialty === 'cardiology') {
      const entries = cardiologyExtras.map(({ key, label }) => `${label}: ${next.cardiology[key as keyof typeof next.cardiology] || ''}`.trim());
      blocks.push(...entries.filter((line) => !line.endsWith(':')));
    }
    if (next.specialty === 'pulmonology_copd') {
      const entries = pulmonologyExtras.map(({ key, label }) => `${label}: ${next.pulmonology[key as keyof typeof next.pulmonology] || ''}`.trim());
      blocks.push(...entries.filter((line) => !line.endsWith(':')));
    }
    const extraNotes = joinIfArray(blocks.filter((line) => line && !line.endsWith(': ')));
    return extraNotes ? `${next.notes}\n\n${extraNotes}`.trim() : next.notes;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...form,
        doctor_id: form.doctor_id || currentUserId,
        notes: syncExtrasIntoNotes(form),
      });
    } catch (err: any) {
      setError(err.message || 'Không thể lưu bệnh án');
    } finally {
      setSaving(false);
    }
  };

  const renderTemplateExtras = () => {
    if (form.specialty === 'general') {
      return null;
    }

    const extraList = form.specialty === 'cardiology' ? cardiologyExtras : pulmonologyExtras;
    const stateKey = form.specialty === 'cardiology' ? 'cardiology' : 'pulmonology';

    return (
      <section className="panel" style={{ marginTop: 16 }}>
        <h3 className="metric-title"><Sparkles size={18} /> {template.label} - Trường bổ sung</h3>
        <div className="cms-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
          {extraList.map((item) => (
            <div className="form-group" key={item.key}>
              <label>{item.label}</label>
              <input
                className={fieldClass}
                value={((form as any)[stateKey][item.key] ?? '') as string}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [stateKey]: {
                      ...(prev as any)[stateKey],
                      [item.key]: e.target.value,
                    },
                  }))
                }
                disabled={readOnly}
                placeholder={item.label}
              />
            </div>
          ))}
        </div>
      </section>
    );
  };

  const renderReadOnlySection = (label: string, value?: string | null, visible = true) => {
    if (!visible) return null;
    return (
      <div className="panel" style={{ marginBottom: 12 }}>
        <div className="role-stat-label" style={{ marginBottom: 8 }}>{label}</div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {value || '—'}
        </div>
      </div>
    );
  };

  if (readOnly || role === 'patient') {
    return (
      <div className="role-page-stack">
        {renderReadOnlySection('Lý do khám/nhập viện', form.chief_complaint)}
        {renderReadOnlySection('Triệu chứng', form.symptoms)}
        {renderReadOnlySection('Chẩn đoán', form.diagnosis)}
        {renderReadOnlySection('Tóm tắt bệnh án', form.disease_summary)}
        {renderReadOnlySection('Chẩn đoán xác định', form.final_diagnosis_summary)}
        {renderReadOnlySection('Điều trị', form.treatment_plan)}
        {renderReadOnlySection('Ghi chú chuyên môn', form.notes, false)}
        {(form.specialty === 'cardiology' || form.specialty === 'pulmonology_copd') && renderTemplateExtras()}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="role-page-stack">
      <div className="panel">
        <div className="metric-header" style={{ marginBottom: 16 }}>
          <div>
            <h3 className="metric-title"><FileText size={18} /> {record ? 'Cập nhật bệnh án' : 'Tạo bệnh án mới'}</h3>
            <p className="role-muted">{template.subtitle}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarDays size={18} />
            <span className="tabular-nums">{form.record_date}</span>
          </div>
        </div>

        {error && (
          <div className="alert-strip high" style={{ marginBottom: 16 }}>
            <div className="alert-strip-body">
              <div className="alert-strip-title">Lỗi</div>
              <div className="alert-strip-desc">{error}</div>
            </div>
          </div>
        )}

        <div className="cms-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <div className="form-group">
            <label>Bệnh nhân *</label>
            <select className={fieldClass} value={form.patient_id} onChange={(e) => setForm((prev) => ({ ...prev, patient_id: e.target.value }))} disabled={readOnly}>
              <option value="">Chọn bệnh nhân</option>
              {assignedPatients.map((patient) => (
                <option key={patient.id} value={patient.id}>{patient.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Chuyên khoa *</label>
            <select className={fieldClass} value={form.specialty} onChange={(e) => setForm((prev) => ({ ...prev, specialty: e.target.value as MedicalRecordTemplateKey }))} disabled={readOnly}>
              {templateOptions.map((item) => (
                <option key={item.key} value={item.key}>{item.label} - {item.subtitle}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Lý do khám/nhập viện *</label>
            <textarea className={fieldClass} rows={3} value={form.chief_complaint} onChange={(e) => setForm((prev) => ({ ...prev, chief_complaint: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Triệu chứng *</label>
            <textarea className={fieldClass} rows={3} value={form.symptoms} onChange={(e) => setForm((prev) => ({ ...prev, symptoms: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Chẩn đoán sơ bộ *</label>
            <textarea className={fieldClass} rows={3} value={form.diagnosis} onChange={(e) => setForm((prev) => ({ ...prev, diagnosis: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Tóm tắt bệnh án</label>
            <textarea className={fieldClass} rows={3} value={form.disease_summary} onChange={(e) => setForm((prev) => ({ ...prev, disease_summary: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Chẩn đoán xác định</label>
            <textarea className={fieldClass} rows={3} value={form.final_diagnosis_summary} onChange={(e) => setForm((prev) => ({ ...prev, final_diagnosis_summary: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Kế hoạch điều trị</label>
            <textarea className={fieldClass} rows={3} value={form.treatment_plan} onChange={(e) => setForm((prev) => ({ ...prev, treatment_plan: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Ghi chú chuyên môn</label>
            <textarea className={fieldClass} rows={4} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Loại khám</label>
            <input className={fieldClass} value={form.visit_type} onChange={(e) => setForm((prev) => ({ ...prev, visit_type: e.target.value }))} disabled={readOnly} />
          </div>
          <div className="form-group">
            <label>Ngày lập bệnh án *</label>
            <input className={fieldClass} type="date" value={form.record_date} onChange={(e) => setForm((prev) => ({ ...prev, record_date: e.target.value }))} disabled={readOnly} />
          </div>
        </div>
      </div>

      {renderTemplateExtras()}

      <div className="panel">
        <h3 className="metric-title"><UserRound size={18} /> Trạng thái ký xác nhận</h3>
        <div className="cms-form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginTop: 12 }}>
          <label className="form-group">
            <span>Hiển thị cho bệnh nhân</span>
            <select className={fieldClass} value={String(form.is_visible_to_patient)} onChange={(e) => setForm((prev) => ({ ...prev, is_visible_to_patient: e.target.value === 'true' }))} disabled={readOnly}>
              <option value="false">Không</option>
              <option value="true">Có</option>
            </select>
          </label>
          <label className="form-group">
            <span>Trạng thái</span>
            <input className={fieldClass} value={form.status} disabled />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          <button type="submit" className="btn btn-primary" disabled={saving || readOnly}>
            <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu nháp'}
          </button>
          {onRequestSign && (
            <button type="button" className="btn btn-secondary" onClick={onRequestSign} disabled={readOnly}>
              <Sparkles size={16} /> Ký xác nhận
            </button>
          )}
          {onCreateAmendment && (
            <button type="button" className="btn btn-secondary" onClick={onCreateAmendment}>
              <Upload size={16} /> Tạo bản bổ sung
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Hủy
          </button>
        </div>
      </div>
    </form>
  );
};
