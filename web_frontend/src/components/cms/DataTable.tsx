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
            {orderedNames.map((column) => (
              <th key={column}>
                <button type="button" onClick={() => onSort(column)}>
                  {column}
                  {sortBy === column ? (sortDir === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />) : null}
                </button>
              </th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)}>
              {orderedNames.map((column) => (
                <td key={column}>{displayValue(row[column])}</td>
              ))}
              <td>
                <div className="cms-row-actions">
                  <button type="button" title="Chi tiết" onClick={() => onView(row)}><Eye size={15} /></button>
                  {onAssignPatient && <button type="button" title="Assign patient" onClick={() => onAssignPatient(row)}>Assign</button>}
                  <button type="button" title="Sửa" onClick={() => onEdit(row)}><Pencil size={15} /></button>
                  <button type="button" title="Xóa" onClick={() => onDelete(row)}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
