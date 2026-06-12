/**
 * Tệp: CardioGuard AI – Nhà cung cấp trạng thái thông báo toàn cục
 * Mục đích: Quản lý danh sách thông báo hoạt động/y tế, số lượng chưa đọc,
 *           cấu hình tuỳ chọn nhận thông báo và hiển thị in-app toast thời gian thực.
 * Luồng xử lý:
 *   1. Lắng nghe CustomEvent 'ws-notification' được phát từ WebSocket App.tsx.
 *   2. Tự động cập nhật danh sách và unreadCount cục bộ khi có thông báo mới.
 *   3. Hiển thị thông báo nhanh (in-app toast) với thiết kế premium (glassmorphism,
 *      harmonies colors, mượt mà chuyển động).
 *   4. Cung cấp các thao tác markRead, markAllRead qua API.
 * Quan hệ:
 *   - Phụ thuộc: useAuth (để lấy accessToken)
 *   - Sử dụng: notificationsService
 *   - Được sử dụng bởi: các layout để hiển thị bell badge, các trang hiển thị thông báo.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsService, Notification, NotificationPreferences } from '../../services/notificationsService';
import { useAuth } from '../../auth/AuthContext';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

interface ToastItem {
  id: string;
  title: string;
  message: string;
  severity: Notification['severity'];
  category: Notification['category'];
  action_url?: string | null;
}

interface NotificationContextProps {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences | null;
  loading: boolean;
  fetchNotifications: (limit?: number, offset?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications phải được sử dụng trong NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { accessToken, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const notificationsRef = useRef<Notification[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // Lấy unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!accessToken) return;
    try {
      const count = await notificationsService.getUnreadCount(accessToken);
      setUnreadCount(count);
    } catch (err) {
      console.error('Lỗi khi lấy số thông báo chưa đọc:', err);
    }
  }, [accessToken]);

  // Lấy danh sách thông báo
  const fetchNotifications = useCallback(async (limit = 50, offset = 0) => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await notificationsService.list(accessToken, { limit, offset });
      setNotifications(response.items);
      setUnreadCount(response.total - response.items.filter(i => i.is_read).length); // Hoặc chỉ cần gọi fetchUnreadCount
      await fetchUnreadCount();
    } catch (err) {
      console.error('Lỗi khi lấy danh sách thông báo:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, fetchUnreadCount]);

  // Lấy preferences
  const fetchPreferences = useCallback(async () => {
    if (!accessToken) return;
    try {
      const prefs = await notificationsService.getPreferences(accessToken);
      setPreferences(prefs);
    } catch (err) {
      console.error('Lỗi khi lấy cấu hình thông báo:', err);
    }
  }, [accessToken]);

  // Khởi tạo tải dữ liệu khi đăng nhập
  useEffect(() => {
    if (accessToken && user) {
      fetchNotifications();
      fetchPreferences();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setPreferences(null);
      setToasts([]);
    }
  }, [accessToken, user, fetchNotifications, fetchPreferences]);

  // Đóng toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Đánh dấu đã đọc 1 thông báo
  const markAsRead = async (id: string) => {
    if (!accessToken) return;
    try {
      const success = await notificationsService.markRead(id, accessToken);
      if (success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Lỗi khi đánh dấu đã đọc:', err);
      throw err;
    }
  };

  // Đánh dấu đã đọc tất cả
  const markAllAsRead = async () => {
    if (!accessToken) return;
    try {
      const success = await notificationsService.markAllRead(accessToken);
      if (success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Lỗi khi đánh dấu đã đọc tất cả:', err);
      throw err;
    }
  };

  // Cập nhật cấu hình nhận thông báo
  const updatePreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    if (!accessToken) return;
    try {
      const updated = await notificationsService.updatePreferences(newPrefs, accessToken);
      setPreferences(updated);
    } catch (err) {
      console.error('Lỗi khi cập nhật tuỳ chọn nhận thông báo:', err);
      throw err;
    }
  };

  // Lắng nghe sự kiện WebSocket realtime
  useEffect(() => {
    const handleWsNotification = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      const data = customEvent.detail;

      if (!data) return;

      // Hỗ trợ sự kiện đồng bộ khi user mark-read tất cả ở thiết bị khác
      if (data.type === 'read_all_sync') {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        return;
      }

      const newNotif = data as Notification;
      const existing = notificationsRef.current.find((item) => item.id === newNotif.id);

      if (existing) {
        setNotifications((prev) =>
          prev.map((item) => (item.id === newNotif.id ? { ...item, ...newNotif } : item))
        );
        if (!existing.is_read && newNotif.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        } else if (existing.is_read && !newNotif.is_read) {
          setUnreadCount((prev) => prev + 1);
        }
        return;
      }

      setNotifications((prev) => [newNotif, ...prev]);

      if (!newNotif.is_read) {
        setUnreadCount((prev) => prev + 1);
        
        // Thêm in-app toast
        const newToast: ToastItem = {
          id: newNotif.id || String(Date.now()),
          title: newNotif.title,
          message: newNotif.message,
          severity: newNotif.severity,
          category: newNotif.category,
          action_url: newNotif.action_url,
        };
        setToasts((prev) => [newToast, ...prev].slice(0, 5)); // Lưu tối đa 5 toast đồng thời

        // Tự động đóng sau 6 giây
        setTimeout(() => {
          removeToast(newToast.id);
        }, 6000);
      }
    };

    window.addEventListener('ws-notification', handleWsNotification);
    return () => {
      window.removeEventListener('ws-notification', handleWsNotification);
    };
  }, [removeToast]);

  // Trả về icon phù hợp với severity
  const getSeverityIcon = (severity: Notification['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle size={20} style={{ color: 'var(--color-critical)' }} />;
      case 'warning':
        return <AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />;
      case 'success':
        return <CheckCircle size={20} style={{ color: 'var(--color-success)' }} />;
      default:
        return <Info size={20} style={{ color: 'var(--color-info)' }} />;
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        updatePreferences,
      }}
    >
      {children}
      
      {/* Container Toast UI cao cấp */}
      <div 
        className="toast-container" 
        style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxWidth: '380px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`premium-toast toast-severity-${toast.severity}`}
            style={{
              display: 'flex',
              gap: '12px',
              padding: '16px',
              borderRadius: '12px',
              background: 'var(--toast-bg, rgba(255, 255, 255, 0.85))',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid var(--toast-border, rgba(255, 255, 255, 0.2))',
              boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08), 0 2px 8px 0 rgba(0, 0, 0, 0.04)',
              pointerEvents: 'auto',
              animation: 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              position: 'relative',
              overflow: 'hidden',
              cursor: toast.action_url ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (toast.action_url) {
                window.location.hash = toast.action_url; // Điều hướng theo hash route
                removeToast(toast.id);
                markAsRead(toast.id).catch(() => {});
              }
            }}
          >
            {/* Thanh màu bên trái cho severity */}
            <div 
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                background: `var(--color-${toast.severity}, var(--color-info))`,
              }}
            />
            
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {getSeverityIcon(toast.severity)}
            </div>
            
            <div style={{ flexGrow: 1, paddingRight: '8px' }}>
              <div 
                style={{ 
                  fontWeight: 600, 
                  fontSize: '0.9rem', 
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                }}
              >
                {toast.title}
              </div>
              <div 
                style={{ 
                  fontSize: '0.8rem', 
                  color: 'var(--text-secondary)',
                  lineHeight: '1.4',
                }}
              >
                {toast.message}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'flex-start',
                marginTop: '-2px',
                alignSelf: 'flex-start',
              }}
              aria-label="Đóng thông báo"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
