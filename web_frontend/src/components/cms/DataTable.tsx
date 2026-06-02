import React from 'react';
import { ArrowDownAZ, ArrowUpAZ, Eye, Pencil, Trash2 } from 'lucide-react';
import type { CmsColumn } from '../../services/cmsApi';

interface DataTableProps {
  rows: Array<Record<string, any>>;
  columns: CmsColumn[];
  preferredColumns: string[];
  sortBy: string;
  sortDir: 'asc' | 'desc';
  loading: boolean;
  onSort: (column: string) => void;
  onView: (row: Record<string, any>) => void;
  onEdit: (row: Record<string, any>) => void;
  onDelete: (row: Record<string, any>) => void;
  onAssignPatient?: (row: Record<string, any>) => void;
}

const displayValue = (value: any) => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value);
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
};

export const DataTable: React.FC<DataTableProps> = ({
  rows,
  columns,
  preferredColumns,
  sortBy,
  sortDir,
  loading,
  onSort,
  onView,
  onEdit,
  onDelete,
  onAssignPatient,
}) => {
  const columnMap = new Map(columns.map((column) => [column.name, column]));
  const orderedNames = [
    ...preferredColumns.filter((column) => columnMap.has(column)),
    ...columns.map((column) => column.name).filter((column) => !preferredColumns.includes(column)),
  ].slice(0, 7);

  if (loading) {
    return <div className="cms-empty-state">Đang tải dữ liệu CMS...</div>;
  }

  if (rows.length === 0) {
    return <div className="cms-empty-state">Không có bản ghi phù hợp bộ lọc hiện tại.</div>;
  }

  return (
    <div className="cms-table-wrap">
      <table className="cms-table">
        <thead>
          <tr>
            {orderedNames.map((column) => {
              const isSorted = sortBy === column;
              const ariaSort = isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
              return (
                <th key={column} aria-sort={ariaSort}>
                  <button 
                    type="button" 
                    onClick={() => onSort(column)}
                    aria-label={`Sắp xếp theo cột ${column}. ${isSorted ? (sortDir === 'asc' ? 'Đang sắp xếp tăng dần' : 'Đang sắp xếp giảm dần') : 'Chưa sắp xếp'}`}
                  >
                    {column}
                    {isSorted ? (sortDir === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />) : null}
                  </button>
                </th>
              );
            })}
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)}>
              {orderedNames.map((column) => {
                const val = row[column];
                const isImg = (column.toLowerCase().includes('image') || column.toLowerCase().includes('avatar') || column.toLowerCase().includes('logo') || column.toLowerCase().includes('photo')) && 
                              (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/')));
                return (
                  <td key={column}>
                    {isImg ? (
                      <img 
                        src={val} 
                        alt="Preview" 
                        style={{ maxWidth: '80px', maxHeight: '50px', borderRadius: '6px', objectFit: 'cover', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=200&auto=format&fit=crop';
                        }}
                      />
                    ) : (
                      displayValue(val)
                    )}
                  </td>
                );
              })}
              <td>
                <div className="cms-row-actions">
                  <button 
                    type="button" 
                    title="Chi tiết" 
                    onClick={() => onView(row)}
                    aria-label={`Xem chi tiết bản ghi ID ${row.id || ''}`}
                  >
                    <Eye size={15} />
                  </button>
                  {onAssignPatient && (
                    <button 
                      type="button" 
                      title="Assign patient" 
                      onClick={() => onAssignPatient(row)}
                      aria-label={`Phân công bệnh nhân cho bản ghi ID ${row.id || ''}`}
                    >
                      Assign
                    </button>
                  )}
                  <button 
                    type="button" 
                    title="Sửa" 
                    onClick={() => onEdit(row)}
                    aria-label={`Chỉnh sửa bản ghi ID ${row.id || ''}`}
                  >
                    <Pencil size={15} />
                  </button>
                  <button 
                    type="button" 
                    title="Xóa" 
                    onClick={() => onDelete(row)}
                    aria-label={`Xóa bản ghi ID ${row.id || ''}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
