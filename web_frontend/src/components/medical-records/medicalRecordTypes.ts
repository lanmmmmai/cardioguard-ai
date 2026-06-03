export type MedicalRecordStatus = 'draft' | 'signed' | 'locked' | 'amended' | 'cancelled';
export type MedicalRecordTemplateKey = 'general' | 'cardiology' | 'pulmonology_copd';
export type MedicalRecordRole = 'doctor' | 'patient' | 'admin';

export interface MedicalRecordProfile {
  user_id?: string;
  full_name?: string | null;
  phone?: string | null;
  gender?: string | null;
  avatar_url?: string | null;
  specialty?: string | null;
  status?: string | null;
}

export interface MedicalRecordRow {
  id: string;
  patient_id: string | null;
  doctor_id: string | null;
  chief_complaint: string | null;
  symptoms: string | null;
  diagnosis: string | null;
  disease_summary: string | null;
  final_diagnosis_summary: string | null;
  treatment_plan: string | null;
  notes: string | null;
  specialty: string | null;
  visit_type: string | null;
  record_date: string | null;
  status: MedicalRecordStatus | string | null;
  is_visible_to_patient: boolean | null;
  signed_by: string | null;
  signed_at: string | null;
  locked_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  patient_profile?: MedicalRecordProfile | null;
  doctor_profile?: MedicalRecordProfile | null;
}

export interface MedicalRecordFormState {
  patient_id: string;
  doctor_id: string;
  chief_complaint: string;
  symptoms: string;
  diagnosis: string;
  disease_summary: string;
  final_diagnosis_summary: string;
  treatment_plan: string;
  notes: string;
  specialty: MedicalRecordTemplateKey;
  visit_type: string;
  record_date: string;
  status: MedicalRecordStatus;
  is_visible_to_patient: boolean;
  signed_by: string;
  signed_at: string;
  locked_at: string;
  cardiology: {
    nyha: string;
    chest_pain: string;
    orthopnea: string;
    leg_edema: string;
    ecg: string;
    echocardiogram: string;
    nt_pro_bnp: string;
    troponin: string;
    ck_mb: string;
    diagnosis_hf: string;
    diagnosis_af: string;
    diagnosis_mi: string;
  };
  pulmonology: {
    cough: string;
    sputum: string;
    dyspnea: string;
    spo2: string;
    lung_rales: string;
    spirometry: string;
    fev1_fvc: string;
    chest_xray: string;
    chest_ct: string;
    sputum_exam: string;
    diagnosis_copd: string;
    diagnosis_asthma: string;
    diagnosis_bronchiectasis: string;
  };
}

export const makeInitialFormState = (): MedicalRecordFormState => ({
  patient_id: '',
  doctor_id: '',
  chief_complaint: '',
  symptoms: '',
  diagnosis: '',
  disease_summary: '',
  final_diagnosis_summary: '',
  treatment_plan: '',
  notes: '',
  specialty: 'general',
  visit_type: 'outpatient',
  record_date: new Date().toISOString().slice(0, 10),
  status: 'draft',
  is_visible_to_patient: false,
  signed_by: '',
  signed_at: '',
  locked_at: '',
  cardiology: {
    nyha: '',
    chest_pain: '',
    orthopnea: '',
    leg_edema: '',
    ecg: '',
    echocardiogram: '',
    nt_pro_bnp: '',
    troponin: '',
    ck_mb: '',
    diagnosis_hf: '',
    diagnosis_af: '',
    diagnosis_mi: '',
  },
  pulmonology: {
    cough: '',
    sputum: '',
    dyspnea: '',
    spo2: '',
    lung_rales: '',
    spirometry: '',
    fev1_fvc: '',
    chest_xray: '',
    chest_ct: '',
    sputum_exam: '',
    diagnosis_copd: '',
    diagnosis_asthma: '',
    diagnosis_bronchiectasis: '',
  },
});

export const templateLabels: Record<MedicalRecordTemplateKey, string> = {
  general: 'Tổng quát',
  cardiology: 'Tim mạch',
  pulmonology_copd: 'Hô hấp/COPD',
};

export const recordStatusLabels: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Bản nháp', tone: 'muted' },
  signed: { label: 'Đã ký', tone: 'success' },
  locked: { label: 'Đã khóa', tone: 'purple' },
  amended: { label: 'Đã bổ sung', tone: 'warning' },
  cancelled: { label: 'Đã hủy', tone: 'danger' },
};

export const generalSections = [
  { key: 'chief_complaint', label: 'Lý do khám/nhập viện', visibleToPatient: true },
  { key: 'symptoms', label: 'Triệu chứng', visibleToPatient: true },
  { key: 'diagnosis', label: 'Chẩn đoán', visibleToPatient: true },
  { key: 'disease_summary', label: 'Tóm tắt bệnh án', visibleToPatient: true },
  { key: 'final_diagnosis_summary', label: 'Chẩn đoán xác định', visibleToPatient: true },
  { key: 'treatment_plan', label: 'Kế hoạch điều trị', visibleToPatient: true },
  { key: 'notes', label: 'Ghi chú chuyên môn', visibleToPatient: false },
];

export const cardiologyExtras = [
  { key: 'nyha', label: 'NYHA' },
  { key: 'chest_pain', label: 'Đau ngực' },
  { key: 'orthopnea', label: 'Khó thở khi nằm' },
  { key: 'leg_edema', label: 'Phù chân' },
  { key: 'ecg', label: 'ECG' },
  { key: 'echocardiogram', label: 'Siêu âm tim' },
  { key: 'nt_pro_bnp', label: 'NT-proBNP' },
  { key: 'troponin', label: 'Troponin' },
  { key: 'ck_mb', label: 'CK-MB' },
  { key: 'diagnosis_hf', label: 'Chẩn đoán suy tim' },
  { key: 'diagnosis_af', label: 'Chẩn đoán rung nhĩ' },
  { key: 'diagnosis_mi', label: 'Chẩn đoán NMCT' },
];

export const pulmonologyExtras = [
  { key: 'cough', label: 'Ho' },
  { key: 'sputum', label: 'Đàm' },
  { key: 'dyspnea', label: 'Khó thở' },
  { key: 'spo2', label: 'SpO2' },
  { key: 'lung_rales', label: 'Ran phổi' },
  { key: 'spirometry', label: 'Chức năng hô hấp' },
  { key: 'fev1_fvc', label: 'FEV1/FVC' },
  { key: 'chest_xray', label: 'X-quang phổi' },
  { key: 'chest_ct', label: 'CT phổi' },
  { key: 'sputum_exam', label: 'Soi/cấy đàm' },
  { key: 'diagnosis_copd', label: 'Chẩn đoán COPD' },
  { key: 'diagnosis_asthma', label: 'Chẩn đoán hen' },
  { key: 'diagnosis_bronchiectasis', label: 'Chẩn đoán dãn phế quản' },
];
