import { Activity, AlertTriangle, Bell, CalendarDays, Camera, Cpu, FileText, HeartPulse, Pill, UserCog, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface CmsModuleConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  templateColumns: string[];
  preferredColumns: string[];
}

export const cmsModules: CmsModuleConfig[] = [
  { key: 'users', label: 'Users', icon: UserCog, templateColumns: ['email', 'full_name', 'phone', 'role', 'password'], preferredColumns: ['full_name', 'email', 'phone', 'role', 'created_at'] },
  { key: 'patients', label: 'Patients', icon: Users, templateColumns: ['full_name', 'age', 'gender', 'phone', 'address', 'medical_history'], preferredColumns: ['full_name', 'age', 'gender', 'phone', 'address'] },
  { key: 'devices', label: 'Devices', icon: Cpu, templateColumns: ['device_name', 'serial_number', 'status', 'battery_level'], preferredColumns: ['device_name', 'serial_number', 'status', 'battery_level'] },
  { key: 'cameras', label: 'Cameras', icon: Camera, templateColumns: ['camera_name', 'location', 'stream_url', 'status', 'assigned_patient_id'], preferredColumns: ['camera_name', 'location', 'stream_url', 'status', 'assigned_patient_id'] },
  { key: 'alerts', label: 'Alerts', icon: AlertTriangle, templateColumns: ['patient_id', 'alert_type', 'message', 'severity', 'is_resolved'], preferredColumns: ['patient_id', 'alert_type', 'severity', 'message', 'created_at'] },
  { key: 'sensor_data', label: 'Sensor Data', icon: Activity, templateColumns: ['patient_id', 'heart_rate', 'spo2', 'systolic_bp', 'diastolic_bp', 'ecg_value', 'created_at'], preferredColumns: ['patient_id', 'heart_rate', 'spo2', 'systolic_bp', 'diastolic_bp', 'created_at'] },
  { key: 'appointments', label: 'Appointments', icon: CalendarDays, templateColumns: ['patient_id', 'doctor_id', 'title', 'status', 'channel', 'scheduled_at', 'notes'], preferredColumns: ['patient_id', 'doctor_id', 'title', 'status', 'scheduled_at'] },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill, templateColumns: ['patient_id', 'doctor_id', 'medication_name', 'dosage', 'frequency', 'instructions', 'status'], preferredColumns: ['patient_id', 'doctor_id', 'medication_name', 'dosage', 'status'] },
  { key: 'medical_records', label: 'Medical Records', icon: FileText, templateColumns: ['patient_id', 'doctor_id', 'type', 'diagnosis', 'summary'], preferredColumns: ['patient_id', 'doctor_id', 'type', 'summary', 'created_at'] },
  { key: 'notifications', label: 'Notifications', icon: Bell, templateColumns: ['user_id', 'patient_id', 'title', 'message', 'type', 'is_read'], preferredColumns: ['user_id', 'title', 'type', 'is_read', 'created_at'] },
  { key: 'reports', label: 'Reports', icon: HeartPulse, templateColumns: ['patient_id', 'doctor_id', 'title', 'report_type', 'content'], preferredColumns: ['patient_id', 'doctor_id', 'title', 'report_type', 'created_at'] },
];

export const moduleByKey = Object.fromEntries(cmsModules.map((module) => [module.key, module]));
