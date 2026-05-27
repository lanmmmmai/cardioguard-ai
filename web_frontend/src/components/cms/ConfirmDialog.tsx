import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog: React.FC<{
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, message, onCancel, onConfirm }) => (
  <div className="modal-overlay">
    <div className="modal-content cms-confirm">
      <AlertTriangle size={24} />
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="cms-confirm-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Hủy</button>
        <button type="button" className="btn btn-primary" onClick={onConfirm}>Xóa</button>
      </div>
    </div>
  </div>
);
