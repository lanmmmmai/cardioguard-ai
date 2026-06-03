import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export const MedicalRecordConfirmSignModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}> = ({ open, onClose, onConfirm, loading = false }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content panel" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 560 }}>
        <button type="button" className="cms-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'rgba(16, 185, 129, 0.08)', color: 'var(--color-safe)' }}>
            <CheckCircle2 size={28} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ marginTop: 0, marginBottom: 10 }}>Ký xác nhận bệnh án</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Sau khi ký, bệnh án sẽ hiển thị cho bệnh nhân và không thể sửa trực tiếp. Bạn có chắc chắn muốn ký không?
            </p>
          </div>
        </div>
        <div className="cms-confirm-actions" style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Đang ký...' : 'Ký xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
};
