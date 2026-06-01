import React, { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import type { CmsColumn } from '../../services/cmsApi';

interface RecordFormModalProps {
  title: string;
  columns: CmsColumn[];
  record: Record<string, any> | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}

const shouldUseTextarea = (column: string) => ['message', 'summary', 'content', 'medical_history', 'notes', 'instructions', 'stream_url'].includes(column);

export const RecordFormModal: React.FC<RecordFormModalProps> = ({ title, columns, record, onClose, onSubmit }) => {
  const editableColumns = columns.filter((column) => !column.readonly);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(Object.fromEntries(editableColumns.map((column) => [column.name, record?.[column.name] ?? ''])));
  }, [record, columns]);

  // Accessibility: Dismiss modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const validate = () => {
    if ('email' in form && form.email && !String(form.email).includes('@')) return 'Email không hợp lệ.';
    if ('phone' in form && form.phone && String(form.phone).length < 7) return 'Số điện thoại không hợp lệ.';
    if ('age' in form && form.age && (Number(form.age) < 0 || Number(form.age) > 130)) return 'Tuổi không hợp lệ.';
    if ('battery' in form && form.battery && (Number(form.battery) < 0 || Number(form.battery) > 100)) return 'Pin phải từ 0 đến 100.';
    return null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Không lưu được bản ghi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form 
        className="modal-content cms-modal" 
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button 
          type="button" 
          className="cms-modal-close" 
          onClick={onClose}
          aria-label="Đóng biểu mẫu"
        >
          <X size={18} />
        </button>
        <h2 id="modal-title">{title}</h2>
        {error && <div className="cms-inline-error" role="alert">{error}</div>}
        <div className="cms-form-grid">
          {editableColumns.map((column) => (
            <div className="form-group" key={column.name}>
              <label htmlFor={`form-input-${column.name}`}>{column.name}</label>
              {column.type === 'bool' ? (
                <select 
                  id={`form-input-${column.name}`}
                  className="form-control" 
                  value={String(form[column.name] ?? '')} 
                  onChange={(event) => setForm((prev) => ({ ...prev, [column.name]: event.target.value }))}
                >
                  <option value="">Null</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : shouldUseTextarea(column.name) ? (
                <textarea 
                  id={`form-input-${column.name}`}
                  className="form-control" 
                  rows={3} 
                  value={form[column.name] ?? ''} 
                  onChange={(event) => setForm((prev) => ({ ...prev, [column.name]: event.target.value }))} 
                />
              ) : (
                <input 
                  id={`form-input-${column.name}`}
                  className="form-control" 
                  value={form[column.name] ?? ''} 
                  onChange={(event) => setForm((prev) => ({ ...prev, [column.name]: event.target.value }))} 
                />
              )}
            </div>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>
  );
};
