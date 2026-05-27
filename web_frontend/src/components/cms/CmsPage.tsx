import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileDown, FileUp, Plus, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { cmsApi, type CmsColumn, type CmsQuery } from '../../services/cmsApi';
import { cmsModules, moduleByKey } from './cmsConfig';
import { DataTable } from './DataTable';
import { RecordFormModal } from './RecordFormModal';
import { DetailModal } from './DetailModal';
import { ConfirmDialog } from './ConfirmDialog';
import { CsvImportModal } from './CsvImportModal';

const limit = 25;

const downloadText = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const CmsPage: React.FC = () => {
  const { accessToken, role } = useAuth();
  const [activeModule, setActiveModule] = useState('cameras');
  const [rows, setRows] = useState<Array<Record<string, any>>>([]);
  const [columns, setColumns] = useState<CmsColumn[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, any> | null | 'new'>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [deleting, setDeleting] = useState<Record<string, any> | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const config = moduleByKey[activeModule];
  const ActiveIcon = config.icon;
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const query = useMemo<CmsQuery>(() => ({
    limit,
    offset,
    q: search.trim() || undefined,
    filter: filter.trim() || undefined,
    sort_by: sortBy,
    sort_dir: sortDir,
  }), [offset, search, filter, sortBy, sortDir]);

  const fetchRows = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await cmsApi.list(activeModule, query, accessToken);
      setRows(data.items);
      setColumns(data.columns);
      setTotal(data.total);
      if (data.columns.length > 0 && !data.columns.some((column) => column.name === sortBy)) {
        setSortBy(data.columns[0].name);
      }
    } catch (err: any) {
      setError(err.message || 'Không tải được CMS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [activeModule, query, accessToken]);

  useEffect(() => {
    setOffset(0);
  }, [activeModule, search, filter]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  };

  const sort = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  const saveRecord = async (payload: Record<string, any>) => {
    if (!accessToken) return;
    if (editing === 'new') {
      await cmsApi.create(activeModule, payload, accessToken);
      showToast('Đã thêm bản ghi mới');
    } else if (editing) {
      await cmsApi.update(activeModule, String(editing.id), payload, accessToken);
      showToast('Đã cập nhật bản ghi');
    }
    await fetchRows();
  };

  const confirmDelete = async () => {
    if (!accessToken || !deleting) return;
    await cmsApi.remove(activeModule, String(deleting.id), accessToken);
    setDeleting(null);
    showToast('Đã xóa bản ghi');
    await fetchRows();
  };

  const exportCsv = async () => {
    if (!accessToken) return;
    const blob = await cmsApi.exportCsv(activeModule, accessToken, { q: search.trim() || undefined, filter: filter.trim() || undefined });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeModule}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    downloadText(`${activeModule}-template.csv`, `${config.templateColumns.join(',')}\n`);
  };

  const formColumns = useMemo(() => {
    if (activeModule === 'users' && editing === 'new') {
      return [...columns, { name: 'password', type: 'text', nullable: false, readonly: false }];
    }
    return columns;
  }, [activeModule, columns, editing]);

  if (role !== 'admin') {
    return <div className="panel cms-empty-state">Bạn không có quyền truy cập CMS.</div>;
  }

  return (
    <div className="cms-page">
      {toast && <div className="cms-toast">{toast}</div>}
      <div className="page-header cms-header">
        <div>
          <h1 className="page-title">CardioGuard CMS</h1>
          <p className="page-subtitle">Quản trị dữ liệu thật từ Supabase cho toàn bộ hệ thống.</p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={fetchRows}><RefreshCw size={16} /> Làm mới</button>
      </div>

      <div className="cms-layout">
        <aside className="panel cms-module-nav">
          {cmsModules.map((module) => {
            const Icon = module.icon;
            return (
              <button key={module.key} type="button" className={module.key === activeModule ? 'active' : ''} onClick={() => setActiveModule(module.key)}>
                <Icon size={16} /> {module.label}
              </button>
            );
          })}
        </aside>

        <section className="panel cms-workspace">
          <div className="cms-toolbar">
            <div className="cms-toolbar-title">
              <ActiveIcon size={20} />
              <strong>{config.label}</strong>
              <span>{total} records</span>
            </div>
            <div className="cms-toolbar-actions">
              <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} /> Add new</button>
              <button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}><FileUp size={16} /> Import CSV</button>
              <button type="button" className="btn btn-secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button>
              <button type="button" className="btn btn-secondary" onClick={downloadTemplate}><FileDown size={16} /> Template</button>
            </div>
          </div>

          <div className="cms-filters">
            <label>
              <Search size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search..." />
            </label>
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter: status:online,role:patient" />
          </div>

          {error && <div className="cms-inline-error">{error}</div>}

          <DataTable
            rows={rows}
            columns={columns}
            preferredColumns={config.preferredColumns}
            sortBy={sortBy}
            sortDir={sortDir}
            loading={loading}
            onSort={sort}
            onView={setDetail}
            onEdit={setEditing}
            onDelete={setDeleting}
            onAssignPatient={activeModule === 'cameras' ? setEditing : undefined}
          />

          <div className="cms-pagination">
            <button type="button" className="btn btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Trước</button>
            <span>Trang {page}/{totalPages}</span>
            <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setOffset(offset + limit)}>Sau</button>
          </div>
        </section>
      </div>

      {editing && (
        <RecordFormModal
          title={editing === 'new' ? `Add ${config.label}` : `Edit ${config.label}`}
          columns={formColumns}
          record={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSubmit={saveRecord}
        />
      )}
      {detail && <DetailModal record={detail} onClose={() => setDetail(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Xóa bản ghi?"
          message={`Bản ghi ${deleting.id} sẽ bị xóa khỏi database.`}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
      {importOpen && (
        <CsvImportModal
          moduleLabel={config.label}
          templateColumns={config.templateColumns}
          onClose={() => setImportOpen(false)}
          onImport={async (file) => {
            if (!accessToken) return null;
            const result = await cmsApi.importCsv(activeModule, file, accessToken);
            await fetchRows();
            return result;
          }}
        />
      )}
    </div>
  );
};
