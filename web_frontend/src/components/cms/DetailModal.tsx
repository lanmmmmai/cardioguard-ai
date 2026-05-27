import React from 'react';
import { X } from 'lucide-react';

export const DetailModal: React.FC<{ record: Record<string, any>; onClose: () => void }> = ({ record, onClose }) => (
  <div className="modal-overlay">
    <div className="modal-content cms-modal">
      <button type="button" className="cms-modal-close" onClick={onClose}><X size={18} /></button>
      <h2>Chi tiết bản ghi</h2>
      <div className="cms-detail-list">
        {Object.entries(record).map(([key, value]) => (
          <div key={key}>
            <span>{key}</span>
            <strong>{value === null || value === undefined || value === '' ? '—' : String(value)}</strong>
          </div>
        ))}
      </div>
    </div>
  </div>
);
