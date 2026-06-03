/**
 * Mục đích: Hộp thoại xác nhận có hỗ trợ tiếp cận cho các hành động nguy hiểm (ví dụ: xóa bản ghi).
 * Luồng xử lý: Hiển thị biểu tượng cảnh báo, tiêu đề, nội dung và các nút Hủy/Xác nhận.
 *              Đóng khi nhấn phím Escape hoặc bấm vào nền phía sau.
 * Quan hệ: Được sử dụng bởi CmsPage và các component con CMS khác để xác nhận xóa.
 */
import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export const ConfirmDialog: React.FC<{
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, message, onCancel, onConfirm }) => {
  // Hỗ trợ tiếp cận: Đóng hộp thoại khi nhấn phím Escape
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
        onClick={(e) => e.stopPropagation()} // Ngăn đóng khi bấm vào nội dung hộp thoại
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
