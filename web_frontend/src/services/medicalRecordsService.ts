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
  console.debug('[fetchProfiles] table=%s userIdCount=%d', table, userIds.length);
  if (userIds.length === 0) return new Map<string, MedicalRecordProfile>();
  console.info('[fetchProfiles] SELECT %s WHERE user_id IN (%d ids)', table, userIds.length);
  const { data, error } = await client
    .from(table)
    .select('user_id, full_name, phone, gender, avatar_url, specialty, status')
    .in('user_id', userIds);
  if (error) {
    console.error('[fetchProfiles] %s error: %s', table, error.message);
    return new Map<string, MedicalRecordProfile>();
  }
  console.info('[fetchProfiles] %s returned %d rows', table, data?.length ?? 0);
  return toProfileMap(data);
};

const enrichRecords = async (client: ReturnType<typeof createSupabaseClient>, rows: MedicalRecordRow[]) => {
  console.debug('[enrichRecords] rowCount=%d', rows.length);
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
  if (response.error) {
    console.error('[withRows] %s', response.error.message || 'Không thể lấy dữ liệu bệnh án');
    throw new Error(response.error.message || 'Không thể lấy dữ liệu bệnh án');
  }
  const rows = Array.isArray(response.data) ? response.data.map(parseRecord) : [];
  console.debug('[withRows] parsed %d rows', rows.length);
  return enrichRecords(client, rows);
};

const applyFilters = (query: any, filters?: QueryFilters) => {
  if (!filters) return query;
  console.debug('[applyFilters] specialty=%s status=%s from=%s to=%s q=%s limit=%s offset=%s',
    filters.specialty, filters.status, filters.from, filters.to, filters.q, filters.limit, filters.offset);
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
    console.debug('[getDoctorAssignedPatients] doctorId=%s', doctorId);
    const client = createSupabaseClient(context.accessToken);
    console.info('[getDoctorAssignedPatients] SELECT doctor_patient WHERE doctor_id = %s', doctorId);
    const { data, error } = await client
      .from('doctor_patient')
      .select('patient_id')
      .eq('doctor_id', doctorId);

    if (error) {
      console.error('[getDoctorAssignedPatients] %s', error.message);
      throw new Error(error.message || 'Không thể lấy danh sách bệnh nhân được phân công');
    }
    const result = Array.from(new Set((data || []).map((item: any) => String(item.patient_id)).filter(Boolean)));
    console.info('[getDoctorAssignedPatients] found %d patients', result.length);
    return result;
  },

  async getDoctorMedicalRecords(context: ServiceContext, doctorId: string, filters?: QueryFilters) {
    console.debug('[getDoctorMedicalRecords] doctorId=%s', doctorId);
    const client = createSupabaseClient(context.accessToken);
    console.info('[getDoctorMedicalRecords] SELECT medical_records WHERE doctor_id = %s', doctorId);
    let query = client.from('medical_records').select('*').eq('doctor_id', doctorId).order('created_at', { ascending: false });
    query = applyFilters(query, filters);
    return withRows(await query, client);
  },

  async getPatientMedicalRecords(context: ServiceContext, patientId: string, filters?: QueryFilters) {
    console.debug('[getPatientMedicalRecords] patientId=%s', patientId);
    const client = createSupabaseClient(context.accessToken);
    console.info('[getPatientMedicalRecords] SELECT medical_records WHERE patient_id = %s', patientId);
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
    console.debug('[getAdminMedicalRecords] filters=%o', filters);
    const client = createSupabaseClient(context.accessToken);
    console.info('[getAdminMedicalRecords] SELECT medical_records (all)');
    let query = client.from('medical_records').select('*').order('created_at', { ascending: false });
    query = applyFilters(query, filters);
    return withRows(await query, client);
  },

  async getMedicalRecordById(context: ServiceContext, recordId: string) {
    console.debug('[getMedicalRecordById] recordId=%s', recordId);
    const client = createSupabaseClient(context.accessToken);
    console.info('[getMedicalRecordById] SELECT medical_records WHERE id = %s', recordId);
    const { data, error } = await client.from('medical_records').select('*').eq('id', recordId).maybeSingle();
    if (error) {
      console.error('[getMedicalRecordById] %s', error.message);
      throw new Error(error.message || 'Không thể tải bệnh án');
    }
    if (!data) {
      console.warn('[getMedicalRecordById] record not found: %s', recordId);
      throw new Error('Không tìm thấy bệnh án');
    }
    const [record] = await enrichRecords(client, [parseRecord(data)]);
    return record;
  },

  async createMedicalRecord(context: ServiceContext, payload: Partial<MedicalRecordFormState>) {
    console.debug('[createMedicalRecord] patientId=%s specialty=%s', payload.patient_id, payload.specialty);
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

    console.info('[createMedicalRecord] INSERT medical_records');
    const { data, error } = await client.from('medical_records').insert(insertPayload).select('*').single();
    if (error) {
      console.error('[createMedicalRecord] %s', error.message);
      throw new Error(error.message || 'Không thể tạo bệnh án');
    }
    console.info('[createMedicalRecord] created id=%s', data.id);
    return parseRecord(data);
  },

  async updateMedicalRecord(context: ServiceContext, recordId: string, payload: Partial<MedicalRecordFormState>) {
    console.debug('[updateMedicalRecord] recordId=%s', recordId);
    const client = createSupabaseClient(context.accessToken);
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

    console.info('[updateMedicalRecord] UPDATE medical_records WHERE id = %s', recordId);
    const { data, error } = await client.from('medical_records').update(updatePayload).eq('id', recordId).select('*').single();
    if (error) {
      console.error('[updateMedicalRecord] %s', error.message);
      throw new Error(error.message || 'Không thể cập nhật bệnh án');
    }
    console.info('[updateMedicalRecord] updated id=%s', recordId);
    return parseRecord(data);
  },

  async signMedicalRecord(context: ServiceContext, recordId: string) {
    console.debug('[signMedicalRecord] recordId=%s', recordId);
    const client = createSupabaseClient(context.accessToken);
    let rpcError: any = null;
    let result: any = null;

    const rpcCandidates = [
      { record_id: recordId },
      { record_uuid: recordId },
    ];

    for (const params of rpcCandidates) {
      console.info('[signMedicalRecord] RPC sign_medical_record params=%o', params);
      const response = await client.rpc('sign_medical_record', params);
      if (!response.error) {
        result = response.data;
        rpcError = null;
        console.info('[signMedicalRecord] RPC succeeded with params=%o', params);
        break;
      }
      console.warn('[signMedicalRecord] RPC failed with params=%o: %s', params, response.error.message);
      rpcError = response.error;
    }

    if (rpcError) {
      console.info('[signMedicalRecord] falling back to direct UPDATE medical_records');
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

      if (fallback.error) {
        console.error('[signMedicalRecord] fallback also failed: %s', fallback.error.message);
        throw new Error(fallback.error.message || 'Không thể ký bệnh án');
      }
      result = fallback.data;
    }

    const signedRecord = result && typeof result === 'object' && 'id' in result ? parseRecord(result) : await this.getMedicalRecordById(context, recordId);

    await this.logMedicalRecordAction(context, {
      action: 'SIGN',
      recordId,
      metadata: { status: 'signed', signed_at: nowIso() },
    });

    await this.createPatientNotification(context, signedRecord.patient_id, signedRecord.id);
    console.info('[signMedicalRecord] signed recordId=%s', recordId);
    return signedRecord;
  },

  async createMedicalRecordAmendment(context: ServiceContext, recordId: string, note?: string) {
    console.debug('[createMedicalRecordAmendment] recordId=%s', recordId);
    const client = createSupabaseClient(context.accessToken);
    const current = await this.getMedicalRecordById(context, recordId);
    console.info('[createMedicalRecordAmendment] INSERT medical_records (amendment of %s)', recordId);
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

    if (error) {
      console.error('[createMedicalRecordAmendment] %s', error.message);
      throw new Error(error.message || 'Không thể tạo bản bổ sung');
    }
    console.info('[createMedicalRecordAmendment] created amended id=%s from recordId=%s', data.id, recordId);
    await this.logMedicalRecordAction(context, {
      action: 'AMEND',
      recordId,
      metadata: { amended_record_id: data.id },
    });
    return parseRecord(data);
  },

  async logMedicalRecordAction(context: ServiceContext, input: { action: string; recordId: string; metadata?: Record<string, any> }) {
    console.debug('[logMedicalRecordAction] action=%s recordId=%s', input.action, input.recordId);
    const client = createSupabaseClient(context.accessToken);
    const payload = {
      user_id: context.currentUserId || null,
      action: input.action,
      target_table: 'medical_records',
      target_id: input.recordId,
      created_at: nowIso(),
      metadata: input.metadata || {},
    };

    console.info('[logMedicalRecordAction] INSERT audit_logs');
    const { error } = await client.from('audit_logs').insert(payload);
    if (error) {
      console.error('[logMedicalRecordAction] %s', error.message);
      console.warn('Không ghi được audit log medical_records:', error.message);
    }
  },

  async createPatientNotification(context: ServiceContext, patientId: string | null, recordId: string) {
    if (!patientId) {
      console.debug('[createPatientNotification] skipped — no patientId');
      return;
    }
    console.debug('[createPatientNotification] patientId=%s recordId=%s', patientId, recordId);
    const client = createSupabaseClient(context.accessToken);
    console.info('[createPatientNotification] INSERT notifications');
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
      console.error('[createPatientNotification] %s', error.message);
      console.warn('Không tạo được notification cho bệnh nhân:', error.message);
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
