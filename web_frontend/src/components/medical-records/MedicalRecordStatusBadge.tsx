import React from 'react';
import type { MedicalRecordStatus } from './medicalRecordTypes';
import { recordStatusLabels } from './medicalRecordTypes';

export const MedicalRecordStatusBadge: React.FC<{ status?: MedicalRecordStatus | string | null }> = ({ status }) => {
  const key = String(status || 'draft') as MedicalRecordStatus;
  const meta = recordStatusLabels[key] || recordStatusLabels.draft;
  return <span className={`patient-status ${meta.tone}`}>{meta.label}</span>;
};
