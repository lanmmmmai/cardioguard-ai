import React, { useMemo, useState } from 'react';
import { FileUp, Upload, X } from 'lucide-react';

interface CsvImportModalProps {
  moduleLabel: string;
  templateColumns: string[];
  onClose: () => void;
  onImport: (file: File) => Promise<any>;
}

const parseCsvPreview = (text: string) => {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines[0]?.split(',').map((item) => item.trim()) || [];
  const rows = lines.slice(1, 6).map((line) => {
    const values = line.split(',');
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
  return { headers, rows, totalRows: Math.max(0, lines.length - 1) };
};

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ moduleLabel, templateColumns, onClose, onImport }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: Array<Record<string, string>>; totalRows: number } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const missingColumns = useMemo(() => {
    if (!preview) return [];
    return templateColumns.filter((column) => !preview.headers.includes(column));
  }, [preview, templateColumns]);

  const handleFile = async (selected: File | null) => {
    setFile(selected);
    setResult(null);
    setErrors([]);
    if (!selected) {
      setPreview(null);
      return;
    }
    const text = await selected.text();
    const parsed = parseCsvPreview(text);
    setPreview(parsed);
    const invalid = parsed.headers.filter((column) => !templateColumns.includes(column));
    const missing = templateColumns.filter((column) => !parsed.headers.includes(column));
    const nextErrors = [
      ...missing.map((column) => `Thiếu cột: ${column}`),
      ...invalid.map((column) => `Cột không thuộc template: ${column}`),
    ];
    setErrors(nextErrors);
  };

  const submit = async () => {
    if (!file || missingColumns.length > 0 || errors.length > 0) return;
    setImporting(true);
    try {
      const response = await onImport(file);
      setResult(response);
    } catch (err: any) {
      setErrors([err.message || 'Import CSV thất bại']);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content cms-modal cms-import-modal">
        <button type="button" className="cms-modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Import CSV - {moduleLabel}</h2>
        <label
          className="cms-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            handleFile(event.dataTransfer.files[0] || null);
          }}
        >
          <FileUp size={28} />
          <span>{file ? file.name : 'Kéo thả CSV hoặc bấm để chọn file'}</span>
          <input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0] || null)} />
        </label>

        <div className="cms-template-note">
          Template columns: <code>{templateColumns.join(',')}</code>
        </div>

        {errors.length > 0 && (
          <div className="cms-inline-error">
            {errors.map((error) => <div key={error}>{error}</div>)}
          </div>
        )}

        {preview && (
          <div className="cms-preview">
            <div>{preview.totalRows} dòng dữ liệu. Preview tối đa 5 dòng:</div>
            <div className="cms-table-wrap">
              <table className="cms-table">
                <thead>
                  <tr>{preview.headers.map((header) => <th key={header}>{header}</th>)}</tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={index}>
                      {preview.headers.map((header) => <td key={header}>{row[header]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && (
          <div className={result.errors?.length ? 'cms-inline-error' : 'cms-inline-success'}>
            Imported: {result.imported}
            {result.errors?.map((item: any) => (
              <div key={item.row}>Dòng {item.row}: {item.errors.join(', ')}</div>
            ))}
          </div>
        )}

        <button type="button" className="btn btn-primary" disabled={!file || errors.length > 0 || missingColumns.length > 0 || importing} onClick={submit}>
          <Upload size={16} /> {importing ? 'Đang import...' : 'Import vào database'}
        </button>
      </div>
    </div>
  );
};
