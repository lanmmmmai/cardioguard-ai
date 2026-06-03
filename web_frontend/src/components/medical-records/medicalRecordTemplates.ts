import type { MedicalRecordTemplateKey } from './medicalRecordTypes';

export interface TemplateSectionDefinition {
  key: string;
  label: string;
  required?: boolean;
  visibleToPatient?: boolean;
}

export interface MedicalRecordTemplateDefinition {
  key: MedicalRecordTemplateKey;
  label: string;
  subtitle: string;
  sections: TemplateSectionDefinition[];
}

export const medicalRecordTemplates: Record<MedicalRecordTemplateKey, MedicalRecordTemplateDefinition> = {
  general: {
    key: 'general',
    label: 'Tổng quát',
    subtitle: 'Form chung cho khám ngoại trú, nhập viện hoặc tái khám.',
    sections: [
      { key: 'chief_complaint', label: 'Lý do khám/nhập viện', required: true, visibleToPatient: true },
      { key: 'symptoms', label: 'Triệu chứng', required: true, visibleToPatient: true },
      { key: 'diagnosis', label: 'Chẩn đoán sơ bộ', visibleToPatient: true },
      { key: 'disease_summary', label: 'Tóm tắt bệnh án', visibleToPatient: true },
      { key: 'final_diagnosis_summary', label: 'Chẩn đoán xác định', visibleToPatient: true },
      { key: 'treatment_plan', label: 'Kế hoạch điều trị', visibleToPatient: true },
      { key: 'notes', label: 'Ghi chú chuyên môn', visibleToPatient: false },
    ],
  },
  cardiology: {
    key: 'cardiology',
    label: 'Tim mạch',
    subtitle: 'Bổ sung các thông số tim mạch, xét nghiệm và chẩn đoán đặc thù.',
    sections: [
      { key: 'chief_complaint', label: 'Lý do khám/nhập viện', required: true, visibleToPatient: true },
      { key: 'symptoms', label: 'Triệu chứng', required: true, visibleToPatient: true },
      { key: 'cardiology.nyha', label: 'NYHA', visibleToPatient: true },
      { key: 'cardiology.chest_pain', label: 'Đau ngực', visibleToPatient: true },
      { key: 'cardiology.orthopnea', label: 'Khó thở khi nằm', visibleToPatient: true },
      { key: 'cardiology.leg_edema', label: 'Phù chân', visibleToPatient: true },
      { key: 'cardiology.ecg', label: 'ECG', visibleToPatient: true },
      { key: 'cardiology.echocardiogram', label: 'Siêu âm tim', visibleToPatient: true },
      { key: 'cardiology.nt_pro_bnp', label: 'NT-proBNP', visibleToPatient: true },
      { key: 'cardiology.troponin', label: 'Troponin', visibleToPatient: true },
      { key: 'cardiology.ck_mb', label: 'CK-MB', visibleToPatient: true },
      { key: 'cardiology.diagnosis_hf', label: 'Chẩn đoán suy tim', visibleToPatient: true },
      { key: 'cardiology.diagnosis_af', label: 'Chẩn đoán rung nhĩ', visibleToPatient: true },
      { key: 'cardiology.diagnosis_mi', label: 'Chẩn đoán NMCT', visibleToPatient: true },
      { key: 'diagnosis', label: 'Chẩn đoán sơ bộ', visibleToPatient: true },
      { key: 'final_diagnosis_summary', label: 'Chẩn đoán xác định', visibleToPatient: true },
      { key: 'treatment_plan', label: 'Kế hoạch điều trị', visibleToPatient: true },
      { key: 'notes', label: 'Ghi chú chuyên môn', visibleToPatient: false },
    ],
  },
  pulmonology_copd: {
    key: 'pulmonology_copd',
    label: 'Hô hấp/COPD',
    subtitle: 'Bổ sung các chỉ số hô hấp, cận lâm sàng và chẩn đoán hô hấp.',
    sections: [
      { key: 'chief_complaint', label: 'Lý do khám/nhập viện', required: true, visibleToPatient: true },
      { key: 'symptoms', label: 'Triệu chứng', required: true, visibleToPatient: true },
      { key: 'pulmonology.cough', label: 'Ho', visibleToPatient: true },
      { key: 'pulmonology.sputum', label: 'Đàm', visibleToPatient: true },
      { key: 'pulmonology.dyspnea', label: 'Khó thở', visibleToPatient: true },
      { key: 'pulmonology.spo2', label: 'SpO2', visibleToPatient: true },
      { key: 'pulmonology.lung_rales', label: 'Ran phổi', visibleToPatient: true },
      { key: 'pulmonology.spirometry', label: 'Chức năng hô hấp', visibleToPatient: true },
      { key: 'pulmonology.fev1_fvc', label: 'FEV1/FVC', visibleToPatient: true },
      { key: 'pulmonology.chest_xray', label: 'X-quang phổi', visibleToPatient: true },
      { key: 'pulmonology.chest_ct', label: 'CT phổi', visibleToPatient: true },
      { key: 'pulmonology.sputum_exam', label: 'Soi/cấy đàm', visibleToPatient: true },
      { key: 'pulmonology.diagnosis_copd', label: 'Chẩn đoán COPD', visibleToPatient: true },
      { key: 'pulmonology.diagnosis_asthma', label: 'Chẩn đoán hen', visibleToPatient: true },
      { key: 'pulmonology.diagnosis_bronchiectasis', label: 'Chẩn đoán dãn phế quản', visibleToPatient: true },
      { key: 'diagnosis', label: 'Chẩn đoán sơ bộ', visibleToPatient: true },
      { key: 'final_diagnosis_summary', label: 'Chẩn đoán xác định', visibleToPatient: true },
      { key: 'treatment_plan', label: 'Kế hoạch điều trị', visibleToPatient: true },
      { key: 'notes', label: 'Ghi chú chuyên môn', visibleToPatient: false },
    ],
  },
};
