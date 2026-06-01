import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog: React.FC<{
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, message, onCancel, onConfirm }) => {
  // Accessibility: Dismiss dialog on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div 
        className="modal-content cms-confirm"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking dialog content
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-desc"
      >
        <AlertTriangle size={24} style={{ color: 'var(--color-critical)', marginBottom: '12px' }} />
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-desc">{message}</p>
        <div className="cms-confirm-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Hủy</button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>Xóa</button>
        </div>
      </div>
    </div>
  );
};
