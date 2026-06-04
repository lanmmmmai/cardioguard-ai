/**
 * Tệp: CardioGuard AI – Quản trị Domain Links CMS
 * Mục đích: Giao diện quản lý các preview link, thông tin SEO, Open Graph (OG tags) và
 *           ảnh đại diện hiển thị khi chia sẻ liên kết trên các mạng xã hội như Zalo,
 *           Facebook, Messenger.
 * Luồng xử lý: 
 *   - Hiển thị danh sách các domain link cấu hình sẵn từ database.
 *   - Hỗ trợ thêm mới, sửa đổi thông tin (path, url, title, description, image_url).
 *   - Cho phép tải ảnh lên máy chủ qua cmsApi để làm ảnh preview.
 *   - Tích hợp khung preview trực quan (chia sẻ preview) ngay khi đang soạn thảo.
 * Quan hệ: Sử dụng AuthContext cho token và tích hợp trực tiếp vào CmsPage làm module phụ.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { cmsApi } from '../../services/cmsApi';

interface DomainLinkRow {
  id: string;
  path: string;
  url: string;
  domain: string;
  title: string;
  description: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  cache_version?: number;
}

interface DomainLinkFormState {
  path: string;
  url: string;
  domain: string;
  title: string;
  description: string;
  image_url: string;
  is_active: boolean;
}

const LIMIT = 12;
const DEFAULT_SITE_URL = 'https://giatky.site';

const blankForm = (): DomainLinkFormState => ({
  path: '/login',
  url: `${DEFAULT_SITE_URL}/login`,
  domain: 'giatky.site',
  title: '',
  description: '',
  image_url: '',
  is_active: true,
});

const derivePathFromUrl = (value: string) => {
  const text = (value || '').trim();
  if (!text) return '/';
  try {
    const parsed = new URL(text);
    return parsed.pathname || '/';
  } catch {
    return text.startsWith('/') ? text : `/${text}`;
  }
};

const deriveUrlFromPath = (value: string) => {
  const path = derivePathFromUrl(value);
  return `${DEFAULT_SITE_URL}${path}`;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const previewStyles: React.CSSProperties = {
  border: '1px solid var(--glass-border)',
  borderRadius: 12,
  overflow: 'hidden',
  background: 'rgba(255, 255, 255, 0.02)',
};

const ModalShell: React.FC<{
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, onClose, children }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cms-modal domain-links-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="cms-modal-close" onClick={onClose} aria-label="Đóng">
          <X size={18} />
        </button>
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ marginBottom: 6 }}>{title}</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
};

interface DomainLinksCmsPageProps {
  embedded?: boolean;
}

export const DomainLinksCmsPage: React.FC<DomainLinksCmsPageProps> = ({ embedded = false }) => {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<DomainLinkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | 'view'>('create');
  const [editingItem, setEditingItem] = useState<DomainLinkRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<string | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [form, setForm] = useState<DomainLinkFormState>(blankForm());

  const page = Math.floor(offset / LIMIT) + 1;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const query = useMemo(() => ({
    limit: LIMIT,
    offset,
    q: search.trim() || undefined,
    sort_by: 'updated_at',
    sort_dir: 'desc' as const,
  }), [offset, search]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  };

  const fetchRows = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const data = await cmsApi.list('domain-links', query, accessToken);
      setItems((data.items || []) as DomainLinkRow[]);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Không tải được domain links');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [accessToken, query]);

  useEffect(() => {
    setOffset(0);
  }, [search]);

  useEffect(() => {
    if (selectedPreview) {
      return () => URL.revokeObjectURL(selectedPreview);
    }
    return undefined;
  }, [selectedPreview]);

  const resetEditor = () => {
    setEditorMode('create');
    setEditingItem(null);
    setForm(blankForm());
    setSelectedPreview(null);
    setUploadWarning(null);
  };

  const openCreate = () => {
    resetEditor();
    setEditorMode('create');
    setEditorOpen(true);
  };

  const openView = (item: DomainLinkRow) => {
    setEditingItem(item);
    setEditorMode('view');
    setForm({
      path: item.path || '/',
      url: item.url || '',
      domain: item.domain || '',
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || '',
      is_active: Boolean(item.is_active),
    });
    setSelectedPreview(null);
    setUploadWarning(null);
    setEditorOpen(true);
  };

  const openEdit = (item: DomainLinkRow) => {
    setEditingItem(item);
    setEditorMode('edit');
    setForm({
      path: item.path || '/',
      url: item.url || '',
      domain: item.domain || '',
      title: item.title || '',
      description: item.description || '',
      image_url: item.image_url || '',
      is_active: Boolean(item.is_active),
    });
    setSelectedPreview(null);
    setUploadWarning(null);
    setEditorOpen(true);
  };

  const handlePathChange = (value: string) => {
    setForm((prev) => {
      const nextPath = value.startsWith('/') ? value : `/${value}`;
      const shouldAutoUrl = !prev.url || prev.url === deriveUrlFromPath(prev.path);
      return {
        ...prev,
        path: nextPath,
        url: shouldAutoUrl ? deriveUrlFromPath(nextPath) : prev.url,
        domain: shouldAutoUrl ? new URL(deriveUrlFromPath(nextPath)).hostname : prev.domain,
      };
    });
  };

  const handleUrlChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      url: value,
      domain: (() => {
        try {
          return new URL(value).hostname;
        } catch {
          return prev.domain;
        }
      })(),
    }));
  };

  const handleFileChange = async (file: File | null) => {
    setUploadWarning(null);
    if (selectedPreview) {
      URL.revokeObjectURL(selectedPreview);
      setSelectedPreview(null);
    }
    if (!file) return;
    setSelectedPreview(URL.createObjectURL(file));
    if (!accessToken) return;
    setUploading(true);
    try {
      const upload = await cmsApi.uploadDomainLinkImage(file, accessToken);
      setForm((prev) => ({ ...prev, image_url: upload.public_url }));
      if (upload.warning) {
        setUploadWarning(upload.warning);
      }
      showToast('Đã tải ảnh preview lên');
    } catch (err: any) {
      setUploadWarning(err.message || 'Không tải được ảnh');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accessToken) return;
    if (!form.path.trim()) {
      setError('Vui lòng nhập path');
      return;
    }
    if (!form.title.trim()) {
      setError('Vui lòng nhập tiêu đề');
      return;
    }
    if (!form.description.trim()) {
      setError('Vui lòng nhập mô tả');
      return;
    }
    if (!form.image_url.trim()) {
      setError('Vui lòng tải lên ảnh preview');
      return;
    }
    if (!form.url.trim()) {
      setError('Vui lòng nhập URL đích');
      return;
    }

    const payload = {
      path: form.path.trim().startsWith('/') ? form.path.trim() : `/${form.path.trim()}`,
      url: form.url.trim(),
      domain: (() => {
        const fallback = form.domain.trim();
        if (fallback) return fallback;
        try {
          return new URL(form.url.trim()).hostname;
        } catch {
          return 'giatky.site';
        }
      })(),
      title: form.title.trim(),
      description: form.description.trim(),
      image_url: form.image_url.trim(),
      is_active: form.is_active,
    };

    setSaving(true);
    setError(null);
    try {
      if (editorMode === 'create') {
        await cmsApi.create('domain-links', payload, accessToken);
        showToast('Đã tạo domain link mới');
      } else if (editingItem) {
        await cmsApi.update('domain-links', editingItem.id, payload, accessToken);
        showToast('Đã cập nhật domain link');
      }
      setEditorOpen(false);
      resetEditor();
      await fetchRows();
    } catch (err: any) {
      setError(err.message || 'Không lưu được domain link');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (item: DomainLinkRow) => {
    if (!accessToken) return;
    try {
      await cmsApi.update('domain-links', item.id, { is_active: !item.is_active }, accessToken);
      showToast(item.is_active ? 'Đã tắt link' : 'Đã kích hoạt link');
      await fetchRows();
    } catch (err: any) {
      showToast(err.message || 'Không đổi được trạng thái');
    }
  };

  const handleDelete = async (item: DomainLinkRow) => {
    if (!accessToken) return;
    if (!window.confirm(`Xóa link "${item.title}"? Mục này sẽ được ẩn khỏi resolve public.`)) return;
    try {
      await cmsApi.remove('domain-links', item.id, accessToken);
      showToast('Đã xóa domain link');
      await fetchRows();
    } catch (err: any) {
      showToast(err.message || 'Không xóa được domain link');
    }
  };

  const currentPreviewImage = selectedPreview || form.image_url || '';
  const currentPreviewTitle = form.title || 'Tiêu đề preview';
  const currentPreviewDescription = form.description || 'Mô tả preview hiển thị tại đây.';
  const currentPreviewUrl = form.url || deriveUrlFromPath(form.path);

  return (
    <div className="domain-links-page">
      {toast && <div className="cms-toast">{toast}</div>}

      {!embedded && (
        <div className="page-header cms-header">
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link2 size={22} style={{ color: 'var(--color-primary)' }} />
              CMS Domain Links
            </h1>
            <p className="page-subtitle">Quản lý preview link cho Zalo, Messenger, Facebook và OG tags.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" onClick={fetchRows}>
              <RefreshCw size={14} /> Làm mới
            </button>
            <button type="button" className="btn btn-primary" onClick={openCreate}>
              <Plus size={14} /> Thêm mẫu link
            </button>
          </div>
        </div>
      )}

      <div className="panel email-cms-panel">
        <div className="domain-links-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <label className="email-logs-search-wrap" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ color: 'var(--text-muted)' }} />
            <input
              className="email-logs-search"
              placeholder="Tìm theo path, title, url..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="email-templates-count">{total} link</span>
            {embedded && (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={fetchRows} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={14} /> Làm mới
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={openCreate} style={{ height: '36px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={14} /> Thêm mẫu link
                </button>
              </>
            )}
          </div>
        </div>

        {error && <div className="cms-inline-error">{error}</div>}

        <div className="email-logs-table-wrap">
          <table className="email-logs-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Path</th>
                <th>Tiêu đề</th>
                <th>Mô tả</th>
                <th>Ảnh preview</th>
                <th>Trạng thái</th>
                <th>Cập nhật</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>
                    <Loader2 className="beat-animated" size={20} style={{ margin: 'auto', display: 'block' }} />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="email-logs-empty">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <Link2 size={32} style={{ opacity: 0.3 }} />
                      <span>Chưa có domain link nào.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.id} className="email-logs-row">
                    <td className="email-logs-cell">{offset + index + 1}</td>
                    <td className="email-logs-cell">
                      <div className="template-name-main">{item.path}</div>
                      <div className="muted-cell">{item.url}</div>
                    </td>
                    <td className="email-logs-cell">
                      <div className="template-name-main">{item.title}</div>
                    </td>
                    <td className="email-logs-cell subject-cell" title={item.description}>
                      {item.description.length > 60 ? `${item.description.slice(0, 60)}...` : item.description}
                    </td>
                    <td className="email-logs-cell">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          style={{ width: 96, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--glass-border)' }}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="email-logs-cell">
                      <span className="email-status-badge" style={{ color: item.is_active ? 'var(--color-safe)' : 'var(--text-muted)' }}>
                        {item.is_active ? <><CheckCircle2 size={13} /> Hoạt động</> : '○ Tắt'}
                      </span>
                    </td>
                    <td className="email-logs-cell muted-cell">{formatDate(item.updated_at)}</td>
                    <td className="email-logs-cell">
                      <div className="email-template-actions">
                        <button type="button" className="email-action-btn" onClick={() => openView(item)} title="Xem">
                          <Eye size={13} />
                        </button>
                        <button type="button" className="email-action-btn" onClick={() => openEdit(item)} title="Sửa">
                          <Pencil size={13} />
                        </button>
                        <button type="button" className="email-action-btn" onClick={() => handleToggle(item)} title={item.is_active ? 'Tắt' : 'Kích hoạt'}>
                          {item.is_active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
                        </button>
                        <button type="button" className="email-action-btn danger" onClick={() => handleDelete(item)} title="Xóa">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="cms-pagination">
          <button type="button" className="btn btn-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            Trước
          </button>
          <span>Trang {page}/{totalPages}</span>
          <button type="button" className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setOffset(offset + LIMIT)}>
            Sau
          </button>
        </div>
      </div>

      {editorOpen && (
        <ModalShell
          title={editorMode === 'create' ? 'Thêm mẫu link domain' : editorMode === 'edit' ? 'Sửa mẫu link domain' : 'Xem mẫu link domain'}
          subtitle="Quản lý preview SEO và chia sẻ nội dung"
          onClose={() => {
            setEditorOpen(false);
            resetEditor();
          }}
        >
          <form className="domain-links-editor" onSubmit={handleSubmit}>
            <div className="domain-links-editor-grid">
              <div className="domain-links-form">
                <div className="form-group">
                  <label>Path</label>
                  <input
                    className="form-control"
                    value={form.path}
                    onChange={(event) => handlePathChange(event.target.value)}
                    placeholder="/login"
                    disabled={editorMode === 'view'}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>Dùng để resolve preview cho một route cụ thể.</small>
                </div>

                <div className="form-group">
                  <label>URL đích</label>
                  <input
                    className="form-control"
                    value={form.url}
                    onChange={(event) => handleUrlChange(event.target.value)}
                    placeholder="https://giatky.site/login"
                    disabled={editorMode === 'view'}
                  />
                </div>

                <div className="form-group">
                  <label>Tiêu đề</label>
                  <input
                    className="form-control"
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="CardioGuard AI - Đăng nhập"
                    disabled={editorMode === 'view'}
                  />
                </div>

                <div className="form-group">
                  <label>Mô tả</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Mô tả preview khi share lên mạng xã hội"
                    disabled={editorMode === 'view'}
                  />
                </div>

                <div className="form-group">
                  <label>Ảnh preview</label>
                  <div className="domain-links-upload">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                      disabled={editorMode === 'view' || uploading}
                    />
                    {uploading && <span className="upload-loader"><Loader2 size={14} className="beat-animated" /> Đang tải ảnh...</span>}
                    {uploadWarning && <span style={{ color: 'var(--color-warning)', fontSize: 12 }}>{uploadWarning}</span>}
                  </div>
                  <small style={{ color: 'var(--text-muted)' }}>Chỉ nhận PNG/JPG/JPEG/WEBP, dung lượng tối đa 5MB.</small>
                </div>

                <div className="form-group">
                  <label>Trạng thái</label>
                  <label className="domain-links-switch">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                      disabled={editorMode === 'view'}
                    />
                    <span>{form.is_active ? 'Hoạt động' : 'Tắt'}</span>
                  </label>
                </div>

                {error && <div className="cms-inline-error">{error}</div>}

                {editorMode !== 'view' && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditorOpen(false)}>
                      Hủy
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
                      {saving ? <Loader2 size={15} className="beat-animated" /> : null}
                      {saving ? 'Đang lưu...' : 'Lưu link'}
                    </button>
                  </div>
                )}
              </div>

              <div className="domain-links-preview-pane">
                <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Link2 size={16} style={{ color: 'var(--color-primary)' }} />
                  <strong>Xem trước chia sẻ</strong>
                </div>
                <div className="domain-links-preview-card" style={previewStyles}>
                  <div className="domain-links-preview-image">
                    {currentPreviewImage ? (
                      <img src={currentPreviewImage} alt={currentPreviewTitle} />
                    ) : (
                      <div className="domain-links-preview-placeholder">Chưa có ảnh preview</div>
                    )}
                  </div>
                  <div className="domain-links-preview-body">
                    <div className="domain-links-preview-domain">{currentPreviewUrl}</div>
                    <h3>{currentPreviewTitle}</h3>
                    <p>{currentPreviewDescription}</p>
                  </div>
                </div>
                <div className="domain-links-preview-meta">
                  <div>
                    <span>Path</span>
                    <strong>{form.path}</strong>
                  </div>
                  <div>
                    <span>URL</span>
                    <strong>{form.url}</strong>
                  </div>
                  <div>
                    <span>Ảnh</span>
                    <strong>{form.image_url ? 'Đã tải lên' : 'Chưa có'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
};
