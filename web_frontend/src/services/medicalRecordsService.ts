import { createSupabaseClient } from '../lib/supabase';
import type {
  MedicalRecordFormState,
  MedicalRecordProfile,
  MedicalRecordRow,
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
};

const nowIso = () => new Date().toISOString();

const normalizeText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const buildWhereTextSearch = (q?: string) => {
  if (!q) return null;
  const term = q.trim();
  if (!term) return null;
  return term;
};

const toProfileMap = (rows: any[] | null | undefined) => {
  const map = new Map<string, MedicalRecordProfile>();
  (rows || []).forEach((row) => {
    if (!row?.user_id) return;
    map.set(String(row.user_id), {
      user_id: String(row.user_id),
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

const fetchProfiles = async (client: ReturnType<typeof createSupabaseClient>, table: 'patient_profiles' | 'doctor_profiles', userIds: string[]) => {
  if (userIds.length === 0) return new Map<string, MedicalRecordProfile>();
  const { data, error } = await client
    .from(table)
    .select('user_id, full_name, phone, gender, avatar_url, specialty, status')
    .in('user_id', userIds);
  if (error) {
    return new Map<string, MedicalRecordProfile>();
  }
  return toProfileMap(data);
};

const enrichRecords = async (client: ReturnType<typeof createSupabaseClient>, rows: MedicalRecordRow[]) => {
  const patientIds = Array.from(new Set(rows.map((row) => row.patient_id).filter(Boolean) as string[]));
  const doctorIds = Array.from(new Set(rows.map((row) => row.doctor_id).filter(Boolean) as string[]));

  const [patientProfiles, doctorProfiles] = await Promise.all([
    fetchProfiles(client, 'patient_profiles', patientIds),
    fetchProfiles(client, 'doctor_profiles', doctorIds),
  ]);

  return rows.map((row) => ({
    ...row,
    patient_profile: row.patient_id ? patientProfiles.get(row.patient_id) || null : null,
    doctor_profile: row.doctor_id ? doctorProfiles.get(row.doctor_id) || null : null,
  }));
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

const withRows = async (response: { data: any; error: any }, client: ReturnType<typeof createSupabaseClient>) => {
  if (response.error) throw new Error(response.error.message || 'Không thể lấy dữ liệu bệnh án');
  const rows = Array.isArray(response.data) ? response.data.map(parseRecord) : [];
  return enrichRecords(client, rows);
};

const applyFilters = (query: any, filters?: QueryFilters) => {
  if (!filters) return query;
  if (filters.specialty) query = query.eq('specialty', filters.specialty);
  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in('status', filters.status);
    else query = query.eq('status', filters.status);
  }
  if (filters.from) query = query.gte('created_at', filters.from);
  if (filters.to) query = query.lte('created_at', filters.to);
  const search = buildWhereTextSearch(filters.q);
  if (search) {
    query = query.or([
      `chief_complaint.ilike.%${search}%`,
      `symptoms.ilike.%${search}%`,
      `diagnosis.ilike.%${search}%`,
      `disease_summary.ilike.%${search}%`,
      `final_diagnosis_summary.ilike.%${search}%`,
      `notes.ilike.%${search}%`,
    ].join(','));
  }
  if (filters.limit) query = query.limit(filters.limit);
  if (filters.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
  return query;
};

export const medicalRecordsService = {
  async getDoctorAssignedPatients(context: ServiceContext, doctorId: string) {
    const client = createSupabaseClient(context.accessToken);
    const { data, error } = await client
      .from('doctor_patient')
      .select('patient_id')
      .eq('doctor_id', doctorId);

    if (error) throw new Error(error.message || 'Không thể lấy danh sách bệnh nhân được phân công');
    return Array.from(new Set((data || []).map((item: any) => String(item.patient_id)).filter(Boolean)));
  },

  async getDoctorMedicalRecords(context: ServiceContext, doctorId: string, filters?: QueryFilters) {
    const client = createSupabaseClient(context.accessToken);
    let query = client.from('medical_records').select('*').eq('doctor_id', doctorId).order('created_at', { ascending: false });
    query = applyFilters(query, filters);
    return withRows(await query, client);
  },

  async getPatientMedicalRecords(context: ServiceContext, patientId: string, filters?: QueryFilters) {
    const client = createSupabaseClient(context.accessToken);
    let query = client
      .from('medical_records')
      .select('*')
      .eq('patient_id', patientId)
      .in('status', ['signed', 'locked', 'amended'])
      .eq('is_visible_to_patient', true)
      .order('created_at', { ascending: false });
    query = applyFilters(query, filters);
    return withRows(await query, client);
  },

  async getAdminMedicalRecords(context: ServiceContext, filters?: QueryFilters) {
    const client = createSupabaseClient(context.accessToken);
    let query = client.from('medical_records').select('*').order('created_at', { ascending: false });
    query = applyFilters(query, filters);
    return withRows(await query, client);
  },

  async getMedicalRecordById(context: ServiceContext, recordId: string) {
    const client = createSupabaseClient(context.accessToken);
    const { data, error } = await client.from('medical_records').select('*').eq('id', recordId).maybeSingle();
    if (error) throw new Error(error.message || 'Không thể tải bệnh án');
    if (!data) throw new Error('Không tìm thấy bệnh án');
    const [record] = await enrichRecords(client, [parseRecord(data)]);
    return record;
  },

  async createMedicalRecord(context: ServiceContext, payload: Partial<MedicalRecordFormState>) {
    const client = createSupabaseClient(context.accessToken);
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

    const { data, error } = await client.from('medical_records').insert(insertPayload).select('*').single();
    if (error) throw new Error(error.message || 'Không thể tạo bệnh án');
    return parseRecord(data);
  },

  async updateMedicalRecord(context: ServiceContext, recordId: string, payload: Partial<MedicalRecordFormState>) {
    const client = createSupabaseClient(context.accessToken);
    const current = await this.getMedicalRecordById(context, recordId);
    if (!current || !['draft', 'amended'].includes(String(current.status))) {
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

    const { data, error } = await client.from('medical_records').update(updatePayload).eq('id', recordId).select('*').single();
    if (error) throw new Error(error.message || 'Không thể cập nhật bệnh án');
    return parseRecord(data);
  },

  async signMedicalRecord(context: ServiceContext, recordId: string) {
    const client = createSupabaseClient(context.accessToken);
    let rpcError: any = null;
    let result: any = null;

    const rpcCandidates = [
      { record_id: recordId },
      { record_uuid: recordId },
    ];

    for (const params of rpcCandidates) {
      const response = await client.rpc('sign_medical_record', params);
      if (!response.error) {
        result = response.data;
        rpcError = null;
        break;
      }
      rpcError = response.error;
    }

    if (rpcError) {
      const fallback = await client
        .from('medical_records')
        .update({
          status: 'signed',
          is_visible_to_patient: true,
          signed_by: context.currentUserId || null,
          signed_at: nowIso(),
          locked_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq('id', recordId)
        .select('*')
        .single();

      if (fallback.error) throw new Error(fallback.error.message || 'Không thể ký bệnh án');
      result = fallback.data;
    }

    const signedRecord = result && typeof result === 'object' && 'id' in result ? parseRecord(result) : await this.getMedicalRecordById(context, recordId);

    await this.logMedicalRecordAction(context, {
      action: 'SIGN',
      recordId,
      metadata: { status: 'signed', signed_at: nowIso() },
    });

    await this.createPatientNotification(context, signedRecord.patient_id, signedRecord.id);
    return signedRecord;
  },

  async createMedicalRecordAmendment(context: ServiceContext, recordId: string, note?: string) {
    const client = createSupabaseClient(context.accessToken);
    const current = await this.getMedicalRecordById(context, recordId);
    const { data, error } = await client.from('medical_records').insert({
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
    }).select('*').single();

    if (error) throw new Error(error.message || 'Không thể tạo bản bổ sung');
    await this.logMedicalRecordAction(context, {
      action: 'AMEND',
      recordId,
      metadata: { amended_record_id: data.id },
    });
    return parseRecord(data);
  },

  async logMedicalRecordAction(context: ServiceContext, input: { action: string; recordId: string; metadata?: Record<string, any> }) {
    const client = createSupabaseClient(context.accessToken);
    const payload = {
      user_id: context.currentUserId || null,
      action: input.action,
      target_table: 'medical_records',
      target_id: input.recordId,
      created_at: nowIso(),
      metadata: input.metadata || {},
    };

    const { error } = await client.from('audit_logs').insert(payload);
    if (error) {
      console.warn('Không ghi được audit log medical_records:', error.message);
    }
  },

  async createPatientNotification(context: ServiceContext, patientId: string | null, recordId: string) {
    if (!patientId) return;
    const client = createSupabaseClient(context.accessToken);
    const { error } = await client.from('notifications').insert({
      user_id: patientId,
      patient_id: patientId,
      title: 'Bệnh án đã được ký xác nhận',
      message: 'Bác sĩ đã ký xác nhận bệnh án mới. Bạn có thể xem trong mục Bệnh án điện tử.',
      type: 'medical_record_signed',
      is_read: false,
      created_at: nowIso(),
      updated_at: nowIso(),
      metadata: { record_id: recordId },
    } as any);
    if (error) {
      console.warn('Không tạo được notification cho bệnh nhân:', error.message);
    }
  },

  serializeTemplateExtras(form: MedicalRecordFormState) {
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
