/**
 * Mục đích: Hộp thoại xem tất cả các trường của một bản ghi CMS dưới dạng danh sách khóa-giá trị.
 * Luồng xử lý: Duyệt qua các mục nhập của bản ghi và hiển thị từng cặp khóa-giá trị; đóng khi
 *              nhấn phím Escape hoặc bấm vào nền phía sau.
 * Quan hệ: Được sử dụng bởi CmsPage như một chế độ xem chỉ đọc trước khi thực hiện sửa/xóa.
 */
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const DetailModal: React.FC<{ record: Record<string, any>; onClose: () => void }> = ({ record, onClose }) => {
  // Hỗ trợ tiếp cận: Đóng hộp thoại khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content cms-modal" 
        onClick={(e) => e.stopPropagation()} // Ngăn đóng khi bấm vào nội dung hộp thoại
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button 
          type="button" 
          className="cms-modal-close" 
          onClick={onClose}
          aria-label="Đóng chi tiết bản ghi"
        >
          <X size={18} />
        </button>
        <h2 id="modal-title">Chi tiết bản ghi</h2>
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
};
