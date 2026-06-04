import { buildApiUrl } from '../config';
import type {
  MedicalRecordFormState,
  MedicalRecordProfile,
  MedicalRecordRow,
  MedicalRecordRole,
  MedicalRecordStatus,
} from '../components/medical-records/medicalRecordTypes';

type QueryFilters = {
  status?: MedicalRecordStatus | MedicalRecordStatus[];
  specialty?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

type ServiceContext = {
  accessToken?: string | null;
  currentUserId?: string | null;
  role?: MedicalRecordRole | null;
};

const nowIso = () => new Date().toISOString();

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const buildWhereTextSearch = (q?: string) => {
  if (!q) return null;
  const term = q.trim();
  if (!term) return null;
  return term;
};

const authHeaders = (token?: string | null): Record<string, string> => (
  token ? { Authorization: `Bearer ${token}` } : {}
);

const jsonHeaders = (token?: string | null): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...authHeaders(token),
});

const requestJson = async <T = any>(path: string, token?: string | null, init: RequestInit = {}) => {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      ...(init.headers || {}),
      ...authHeaders(token),
    },
  });

  const body = await response.text();
  if (!response.ok) {
    if (!body) {
      throw new Error(`Yêu cầu thất bại (${response.status})`);
    }
    try {
      const data = JSON.parse(body);
      if (Array.isArray(data.detail)) {
        throw new Error(data.detail.map((item: any) => item.msg || item).join(', '));
      }
      throw new Error(data.detail || data.message || data.error || `Yêu cầu thất bại (${response.status})`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(body);
      }
      throw error;
    }
  }

  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('Lỗi định dạng phản hồi từ server');
  }
};

const toProfileMap = (rows: any[] | null | undefined) => {
  const map = new Map<string, MedicalRecordProfile>();
  (rows || []).forEach((row) => {
    const userId = row?.id;
    if (!userId) return;
    map.set(String(userId), {
      user_id: row.user_id ? String(row.user_id) : String(row.id),
      full_name: row.full_name || row.name || null,
      phone: row.phone || null,
      gender: row.gender || null,
      avatar_url: row.avatar_url || null,
      specialty: row.specialty || null,
      status: row.status || null,
    });
  });
  return map;
};

const fetchProfileMap = async (context: ServiceContext, path: string) => {
  if (!context.accessToken) return new Map<string, MedicalRecordProfile>();
  try {
    const response = await requestJson<any>(path, context.accessToken);
    const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [response];
    return toProfileMap(items);
  } catch (error) {
    console.warn('[fetchProfileMap] path=%s failed: %s', path, error instanceof Error ? error.message : String(error));
    return new Map<string, MedicalRecordProfile>();
  }
};

const fetchPatientProfiles = async (context: ServiceContext) => {
  if (!context.accessToken) return new Map<string, MedicalRecordProfile>();
  if (context.role === 'patient') {
    const profile = await requestJson<any>('/patient/profile', context.accessToken);
    if (!context.currentUserId) return new Map<string, MedicalRecordProfile>();
    return new Map([[String(context.currentUserId), {
      user_id: String(context.currentUserId),
      full_name: profile.full_name || null,
      phone: profile.phone || null,
      gender: profile.gender || null,
      avatar_url: profile.avatar_url || null,
      specialty: profile.specialty || null,
      status: profile.status || null,
    }]]);
  }

  return fetchProfileMap(context, '/patients?limit=500&offset=0');
};

const fetchDoctorProfiles = async (context: ServiceContext) => {
  if (!context.accessToken) return new Map<string, MedicalRecordProfile>();
  if (context.role === 'doctor') {
    const profile = await requestJson<any>('/doctor/profile', context.accessToken);
    if (!context.currentUserId) return new Map<string, MedicalRecordProfile>();
    return new Map([[String(context.currentUserId), {
      user_id: String(context.currentUserId),
      full_name: profile.full_name || null,
      phone: profile.phone || null,
      gender: profile.gender || null,
      avatar_url: profile.avatar_url || null,
      specialty: profile.specialty || null,
      status: profile.status || null,
    }]]);
  }
  if (context.role === 'patient') {
    return fetchProfileMap(context, '/patients/me/doctors');
  }
  return fetchProfileMap(context, '/admin/doctors?limit=500&offset=0');
};

const enrichRecords = async (context: ServiceContext, rows: MedicalRecordRow[]) => {
  console.debug('[enrichRecords] rowCount=%d', rows.length);
  const [patientProfiles, doctorProfiles] = await Promise.all([
    fetchPatientProfiles(context),
    fetchDoctorProfiles(context),
  ]);

  return rows.map((row) => {
    const patientProfile = row.patient_id ? patientProfiles.get(row.patient_id) || null : null;
    const doctorProfile = row.doctor_id ? doctorProfiles.get(row.doctor_id) || null : null;
    return {
      ...row,
      patient_profile: patientProfile,
      doctor_profile: doctorProfile,
    };
  });
};

const parseRecord = (row: any): MedicalRecordRow => ({
  id: String(row.id),
  patient_id: row.patient_id ? String(row.patient_id) : null,
  doctor_id: row.doctor_id ? String(row.doctor_id) : null,
  chief_complaint: row.chief_complaint ?? row.reason ?? null,
  symptoms: row.symptoms ?? null,
  diagnosis: row.diagnosis ?? null,
  disease_summary: row.disease_summary ?? row.summary ?? row.clinical_summary ?? null,
  final_diagnosis_summary: row.final_diagnosis_summary ?? null,
  treatment_plan: row.treatment_plan ?? null,
  notes: row.notes ?? null,
  specialty: row.specialty ?? null,
  visit_type: row.visit_type ?? null,
  record_date: row.record_date ?? null,
  status: row.status ?? null,
  is_visible_to_patient: Boolean(row.is_visible_to_patient),
  signed_by: row.signed_by ?? null,
  signed_at: row.signed_at ?? null,
  locked_at: row.locked_at ?? null,
  created_at: row.created_at ?? null,
  updated_at: row.updated_at ?? null,
});

const withRows = async (data: any, context: ServiceContext) => {
  if (!data) {
    return [];
  }
  const rows = Array.isArray(data.items) ? data.items.map(parseRecord) : Array.isArray(data) ? data.map(parseRecord) : [];
  console.debug('[withRows] parsed %d rows', rows.length);
  return enrichRecords(context, rows);
};

const applyClientFilters = (rows: MedicalRecordRow[], filters?: QueryFilters) => {
  if (!filters) return rows;
  let result = [...rows];
  if (filters.specialty) result = result.filter((row) => row.specialty === filters.specialty);
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    result = result.filter((row) => row.status && statuses.includes(row.status as MedicalRecordStatus));
  }
  if (filters.from) result = result.filter((row) => (row.created_at || '') >= filters.from!);
  if (filters.to) result = result.filter((row) => (row.created_at || '') <= filters.to!);
  const search = buildWhereTextSearch(filters.q);
  if (search) {
    const q = search.toLowerCase();
    result = result.filter((row) =>
      [
        row.chief_complaint,
        row.symptoms,
        row.diagnosis,
        row.disease_summary,
        row.final_diagnosis_summary,
        row.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    );
  }
  return result;
};

export const medicalRecordsService = {
  async getDoctorAssignedPatients(context: ServiceContext, doctorId: string) {
    console.debug('[getDoctorAssignedPatients] doctorId=%s', doctorId);
    try {
      const response = await requestJson<any>('/patients?limit=500&offset=0', context.accessToken);
      const items = Array.isArray(response?.items) ? response.items : [];
      const result = Array.from(new Set(items.map((item: any) => String(item.id)).filter(Boolean)));
      console.info('[getDoctorAssignedPatients] found %d patients', result.length);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lấy danh sách bệnh nhân được phân công';
      console.error('[getDoctorAssignedPatients] %s', message);
      throw new Error(message || 'Không thể lấy danh sách bệnh nhân được phân công');
    }
  },

  async getDoctorMedicalRecords(context: ServiceContext, doctorId: string, filters?: QueryFilters) {
    console.debug('[getDoctorMedicalRecords] doctorId=%s', doctorId);
    const response = await requestJson<any>('/medical-records?limit=500&offset=0', context.accessToken);
    const rows = await withRows(response, context);
    return applyClientFilters(rows.filter((row) => !doctorId || row.doctor_id === doctorId), filters);
  },

  async getPatientMedicalRecords(context: ServiceContext, patientId: string, filters?: QueryFilters) {
    console.debug('[getPatientMedicalRecords] patientId=%s', patientId);
    const response = await requestJson<any>('/medical-records?limit=500&offset=0', context.accessToken);
    const rows = await withRows(response, context);
    const filtered = rows.filter((row) =>
      (!patientId || row.patient_id === patientId) &&
      ['signed', 'locked', 'amended'].includes(String(row.status)) &&
      row.is_visible_to_patient === true
    );
    return applyClientFilters(filtered, filters);
  },

  async getAdminMedicalRecords(context: ServiceContext, filters?: QueryFilters) {
    console.debug('[getAdminMedicalRecords] filters=%o', filters);
    const response = await requestJson<any>('/medical-records?limit=500&offset=0', context.accessToken);
    const rows = await withRows(response, context);
    return applyClientFilters(rows, filters);
  },

  async getMedicalRecordById(context: ServiceContext, recordId: string) {
    console.debug('[getMedicalRecordById] recordId=%s', recordId);
    const data = await requestJson<any>(`/medical-records/${recordId}`, context.accessToken);
    if (!data) {
      console.warn('[getMedicalRecordById] record not found: %s', recordId);
      throw new Error('Không tìm thấy bệnh án');
    }
    const [record] = await enrichRecords(context, [parseRecord(data)]);
    return record;
  },

  async createMedicalRecord(context: ServiceContext, payload: Partial<MedicalRecordFormState>) {
    console.debug('[createMedicalRecord] patientId=%s specialty=%s', payload.patient_id, payload.specialty);
    const insertPayload = {
      patient_id: payload.patient_id || null,
      doctor_id: payload.doctor_id || context.currentUserId || null,
      chief_complaint: normalizeText(payload.chief_complaint),
      symptoms: normalizeText(payload.symptoms),
      diagnosis: normalizeText(payload.diagnosis),
      disease_summary: normalizeText(payload.disease_summary),
      final_diagnosis_summary: normalizeText(payload.final_diagnosis_summary),
      treatment_plan: normalizeText(payload.treatment_plan),
      notes: normalizeText(payload.notes),
      specialty: payload.specialty || 'general',
      visit_type: payload.visit_type || 'outpatient',
      record_date: payload.record_date || new Date().toISOString().slice(0, 10),
      status: 'draft' as MedicalRecordStatus,
      is_visible_to_patient: false,
      signed_by: null,
      signed_at: null,
      locked_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    console.info('[createMedicalRecord] POST /medical-records');
    const data = await requestJson<any>('/medical-records', context.accessToken, {
      method: 'POST',
      headers: jsonHeaders(context.accessToken),
      body: JSON.stringify(insertPayload),
    });
    console.info('[createMedicalRecord] created id=%s', data.id);
    return parseRecord(data);
  },

  async updateMedicalRecord(context: ServiceContext, recordId: string, payload: Partial<MedicalRecordFormState>) {
    console.debug('[updateMedicalRecord] recordId=%s', recordId);
    const current = await this.getMedicalRecordById(context, recordId);
    if (!current || !['draft', 'amended'].includes(String(current.status))) {
      console.warn('[updateMedicalRecord] cannot edit signed record %s (status=%s)', recordId, current?.status);
      throw new Error('Bệnh án đã ký, cần tạo bản bổ sung/chỉnh sửa thay vì sửa trực tiếp.');
    }

    const updatePayload = {
      chief_complaint: normalizeText(payload.chief_complaint),
      symptoms: normalizeText(payload.symptoms),
      diagnosis: normalizeText(payload.diagnosis),
      disease_summary: normalizeText(payload.disease_summary),
      final_diagnosis_summary: normalizeText(payload.final_diagnosis_summary),
      treatment_plan: normalizeText(payload.treatment_plan),
      notes: normalizeText(payload.notes),
      specialty: payload.specialty || current.specialty || 'general',
      visit_type: payload.visit_type || current.visit_type || 'outpatient',
      record_date: payload.record_date || current.record_date,
      is_visible_to_patient: Boolean(payload.is_visible_to_patient),
      status: payload.status || current.status || 'draft',
      updated_at: nowIso(),
    };

    console.info('[updateMedicalRecord] PATCH /medical-records/%s', recordId);
    const data = await requestJson<any>(`/medical-records/${recordId}`, context.accessToken, {
      method: 'PATCH',
      headers: jsonHeaders(context.accessToken),
      body: JSON.stringify(updatePayload),
    });
    console.info('[updateMedicalRecord] updated id=%s', recordId);
    return parseRecord(data);
  },

  async signMedicalRecord(context: ServiceContext, recordId: string) {
    console.debug('[signMedicalRecord] recordId=%s', recordId);
    const result = await requestJson<any>(`/medical-records/${recordId}`, context.accessToken, {
      method: 'PATCH',
      headers: jsonHeaders(context.accessToken),
      body: JSON.stringify({
        status: 'signed',
        is_visible_to_patient: true,
        signed_by: context.currentUserId || null,
        signed_at: nowIso(),
        locked_at: nowIso(),
        updated_at: nowIso(),
      }),
    });

    const signedRecord = parseRecord(result);
    await this.createPatientNotification(context, signedRecord.patient_id, signedRecord.id);
    console.info('[signMedicalRecord] signed recordId=%s', recordId);
    return signedRecord;
  },

  async createMedicalRecordAmendment(context: ServiceContext, recordId: string, note?: string) {
    console.debug('[createMedicalRecordAmendment] recordId=%s', recordId);
    const current = await this.getMedicalRecordById(context, recordId);
    console.info('[createMedicalRecordAmendment] POST /medical-records (amendment of %s)', recordId);
    const data = await requestJson<any>('/medical-records', context.accessToken, {
      method: 'POST',
      headers: jsonHeaders(context.accessToken),
      body: JSON.stringify({
      patient_id: current.patient_id,
      doctor_id: current.doctor_id || context.currentUserId || null,
      chief_complaint: current.chief_complaint,
      symptoms: current.symptoms,
      diagnosis: current.diagnosis,
      disease_summary: current.disease_summary,
      final_diagnosis_summary: current.final_diagnosis_summary,
      treatment_plan: current.treatment_plan,
      notes: [current.notes, note || 'Bản bổ sung được tạo từ hồ sơ đã ký.'].filter(Boolean).join('\n\n'),
      specialty: current.specialty,
      visit_type: current.visit_type,
      record_date: current.record_date || new Date().toISOString().slice(0, 10),
      status: 'amended',
      is_visible_to_patient: true,
      signed_by: null,
      signed_at: null,
      locked_at: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      }),
    });
    console.info('[createMedicalRecordAmendment] created amended id=%s from recordId=%s', data.id, recordId);
    return parseRecord(data);
  },

  async createPatientNotification(context: ServiceContext, patientId: string | null, recordId: string) {
    if (!patientId) {
      console.debug('[createPatientNotification] skipped — no patientId');
      return;
    }
    console.debug('[createPatientNotification] patientId=%s recordId=%s', patientId, recordId);
    console.info('[createPatientNotification] POST /notifications');
    try {
      await requestJson('/notifications', context.accessToken, {
        method: 'POST',
        headers: jsonHeaders(context.accessToken),
        body: JSON.stringify({
          user_id: patientId,
          patient_id: patientId,
          title: 'Bệnh án đã được ký xác nhận',
          message: 'Bác sĩ đã ký xác nhận bệnh án mới. Bạn có thể xem trong mục Bệnh án điện tử.',
          type: 'medical_record_signed',
          is_read: false,
          created_at: nowIso(),
          updated_at: nowIso(),
          metadata: { record_id: recordId },
        } as any),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tạo được notification cho bệnh nhân';
      console.error('[createPatientNotification] %s', message);
      console.warn('Không tạo được notification cho bệnh nhân:', message);
    }
  },

  serializeTemplateExtras(form: MedicalRecordFormState) {
    console.debug('[serializeTemplateExtras] specialty=%s', form.specialty);
    const blocks: string[] = [];
    if (form.specialty === 'cardiology') {
      const items: Array<[string, string]> = [
        ['NYHA', form.cardiology.nyha],
        ['Đau ngực', form.cardiology.chest_pain],
        ['Khó thở khi nằm', form.cardiology.orthopnea],
        ['Phù chân', form.cardiology.leg_edema],
        ['ECG', form.cardiology.ecg],
        ['Siêu âm tim', form.cardiology.echocardiogram],
        ['NT-proBNP', form.cardiology.nt_pro_bnp],
        ['Troponin', form.cardiology.troponin],
        ['CK-MB', form.cardiology.ck_mb],
        ['Chẩn đoán suy tim', form.cardiology.diagnosis_hf],
        ['Chẩn đoán rung nhĩ', form.cardiology.diagnosis_af],
        ['Chẩn đoán NMCT', form.cardiology.diagnosis_mi],
      ];
      items.forEach(([label, value]) => {
        if (value) blocks.push(`${label}: ${value}`);
      });
    }
    if (form.specialty === 'pulmonology_copd') {
      const items: Array<[string, string]> = [
        ['Ho', form.pulmonology.cough],
        ['Đàm', form.pulmonology.sputum],
        ['Khó thở', form.pulmonology.dyspnea],
        ['SpO2', form.pulmonology.spo2],
        ['Ran phổi', form.pulmonology.lung_rales],
        ['Chức năng hô hấp', form.pulmonology.spirometry],
        ['FEV1/FVC', form.pulmonology.fev1_fvc],
        ['X-quang phổi', form.pulmonology.chest_xray],
        ['CT phổi', form.pulmonology.chest_ct],
        ['Soi/cấy đàm', form.pulmonology.sputum_exam],
        ['Chẩn đoán COPD', form.pulmonology.diagnosis_copd],
        ['Chẩn đoán hen', form.pulmonology.diagnosis_asthma],
        ['Chẩn đoán dãn phế quản', form.pulmonology.diagnosis_bronchiectasis],
      ];
      items.forEach(([label, value]) => {
        if (value) blocks.push(`${label}: ${value}`);
      });
    }
    return blocks.join('\n');
  },
};
