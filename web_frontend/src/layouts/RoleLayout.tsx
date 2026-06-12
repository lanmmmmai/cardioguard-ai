/**
 * Tệp: CardioGuard AI – Bố cục shell ứng dụng dựa trên vai trò
 * Mục đích: Cung cấp vùng sidebar + tiêu đề + nội dung chung cho tất cả
 *           vai trò đã xác thực. Bao gồm sidebar phản hồi, điều hướng dưới cùng
 *           trên thiết bị di động, drawer di động, chuyển đổi chủ đề, thẻ người dùng
 *           và trạng thái kết nối.
 * Luồng xử lý: 1. Nhận vai trò, đường dẫn, điều hướng, chủ đề và thành phần con.
 *              2. Hiển thị sidebar dọc (máy tính) + điều hướng dưới cùng (di động).
 *              3. Trên di động, drawer hiển thị menu rút gọn dạng thu gọn.
 *              4. Tiêu đề hiển thị nhãn vai trò, tiêu đề trang, nút chủ đề, thẻ người dùng.
 * Quan hệ:
 *   - sử dụng: AuthContext (user, logout), roleMenus, routeMeta (pageTitles)
 *   - xuất AdminLayout, DoctorLayout, PatientLayout cho App.tsx
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Activity, AlertTriangle, LogOut, Loader2, Menu, Moon, Sun, MoreHorizontal, X, ChevronDown, ChevronRight, Bell } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { type UserRole } from '../auth/roles';
import { roleMenus } from '../navigation/roleMenus';
import { API_URL } from '../config';
import { translateCommonLabel, translateMenuLabel, translateRoleLabel, useLocale } from '../i18n/locale';
import { useNotifications } from '../components/notifications/NotificationProvider';

interface RoleLayoutProps {
  role: UserRole;
  currentPath: string;
  navigate: (path: string, replace?: boolean) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  children: React.ReactNode;
  isConnected?: boolean;
}

const layoutTitle: Record<UserRole, string> = {
  admin: 'layout_admin',
  doctor: 'layout_doctor',
  patient: 'layout_patient',
};

/**
 * RoleLayout – Shell ứng dụng đầy đủ với sidebar, tiêu đề, điều hướng di động
 * và drawer trượt lên hỗ trợ cơ chế thu gọn/mở rộng nhóm (collapsible accordion).
 *
 * @param props - Các thuộc tính cấu hình bao gồm vai trò, đường dẫn hiện tại và hành động điều phối.
 */
export const RoleLayout: React.FC<RoleLayoutProps> = ({
  role,
  currentPath,
  navigate,
  theme,
  onToggleTheme,
  children,
  isConnected = false,
}) => {
  const { user, logout, accessToken } = useAuth();
  const { locale, setLocale } = useLocale();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const menuItems = roleMenus[role];
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isBellDropdownOpen, setIsBellDropdownOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Phân nhóm động các mục menu theo trường group
  const groupedMenuItems = useMemo(() => {
    const groups: Record<string, typeof menuItems> = {};
    menuItems.forEach((item) => {
      const g = item.group || 'none';
      if (!groups[g]) {
        groups[g] = [];
      }
      groups[g].push(item);
    });
    return groups;
  }, [menuItems]);

  // Trạng thái theo dõi việc đóng/mở của các nhóm menu
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    menuItems.forEach((item) => {
      if (item.path === currentPath && item.group) {
        initial[item.group] = true;
      }
    });
    return initial;
  });

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  /**
   * Chuẩn hóa đường dẫn media về URL API tuyệt đối.
   *
   * @param path - Đường dẫn ảnh thô từ DB.
   */
  const getMediaUrl = (path?: string | null) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.includes('avatars/')) return `${API_URL}${path}`;
    return `${API_URL}${path}?token=${accessToken}`;
  };

  // Đóng drawer di động khi nhấn phím Escape để hỗ trợ trợ năng
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        if (!loggingOut) setShowLogoutModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loggingOut]);

  const handleLogout = () => {
    setLogoutError(null);
    setShowLogoutModal(true);
  };

  const confirmLogoutAction = async () => {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      logout();
      setShowLogoutModal(false);
      if (role === 'admin') navigate('/login-admin', true);
      else if (role === 'doctor') navigate('/login-doctor', true);
      else navigate('/login', true);
    } catch {
      setLogoutError(locale === 'en' ? 'Logout failed. Please try again.' : 'Đăng xuất thất bại. Vui lòng thử lại.');
      setLoggingOut(false);
    }
  };

  return (
    <div className="role-shell">
      <aside className="role-sidebar">
        <div className="role-brand">
          <div className="brand-icon">
            <Activity className="beat-animated" size={22} />
          </div>
          <div>
            <div className="brand-name">CardioGuard AI</div>
            <div className="role-brand-subtitle">{translateCommonLabel(layoutTitle[role], locale)}</div>
          </div>
        </div>

        <nav className="role-menu" aria-label={`${translateCommonLabel('all_features', locale)} ${translateRoleLabel(role, locale)}`}>
          {Object.entries(groupedMenuItems).map(([groupKey, items]) => {
            const hasHeader = groupKey !== 'none' && groupKey !== '';
            
            // Nếu không có nhóm hoặc nhóm chỉ có 1 mục, hiển thị trực tiếp
            if (!hasHeader || items.length <= 1) {
              return items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    className={`role-menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                  >
                    <Icon size={18} />
                    <span>{translateMenuLabel(item.label, locale)}</span>
                  </button>
                );
              });
            }

            const isExpanded = !!expandedGroups[groupKey];
            const GroupIcon = items[0]?.icon || Activity;
            const hasActiveChild = items.some((item) => currentPath === item.path);

            return (
              <div key={groupKey} className={`menu-group-container ${hasActiveChild ? 'has-active' : ''}`}>
                <button
                  type="button"
                  className={`menu-group-toggle ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleGroup(groupKey)}
                >
                  <div className="group-toggle-left">
                    <GroupIcon size={18} />
                    <span>{translateCommonLabel(groupKey, locale)}</span>
                  </div>
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                
                {isExpanded && (
                  <div className="menu-group-sub-items">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentPath === item.path;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          className={`role-menu-item sub-item ${isActive ? 'active' : ''}`}
                          onClick={() => navigate(item.path)}
                        >
                          <Icon size={16} />
                          <span>{translateMenuLabel(item.label, locale)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <button type="button" className="role-menu-item logout" onClick={handleLogout}>
          <LogOut size={18} />
          <span>{translateCommonLabel('logout', locale)}</span>
        </button>
      </aside>

      <div className="role-main">
        <header className="role-header">
          <div className="role-header-left">
            <Menu size={20} className="role-mobile-icon" onClick={() => setIsMobileMenuOpen(true)} />
            <div>
              <div className="role-header-kicker">{translateRoleLabel(role, locale)}</div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {translateCommonLabel(layoutTitle[role], locale)}
                <span 
                  className={`connection-status-dot ${isConnected ? 'connected' : 'disconnected'}`} 
                  title={isConnected ? (locale === 'en' ? 'Realtime connected (online)' : 'Đang kết nối realtime (Trực tuyến)') : (locale === 'en' ? 'Realtime disconnected (offline)' : 'Mất kết nối realtime (Ngoại tuyến)')}
                />
              </h1>
            </div>
          </div>

          <div className="role-header-actions">
            <div className="locale-switch" role="group" aria-label={translateCommonLabel('language', locale)}>
              <button
                type="button"
                className={locale === 'vi' ? 'active' : ''}
                onClick={() => setLocale('vi')}
              >
                VI
              </button>
              <button
                type="button"
                className={locale === 'en' ? 'active' : ''}
                onClick={() => setLocale('en')}
              >
                EN
              </button>
            </div>
            {isBellDropdownOpen && (
              <div 
                className="bell-dropdown-overlay" 
                style={{ position: 'fixed', inset: 0, zIndex: 998 }} 
                onClick={() => setIsBellDropdownOpen(false)} 
              />
            )}

            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <button
                type="button"
                className="notification-bell-container"
                onClick={() => setIsBellDropdownOpen(!isBellDropdownOpen)}
                title={locale === 'en' ? 'Notifications' : 'Thông báo'}
              >
                <Bell className={`bell-icon ${unreadCount > 0 ? 'has-unread' : ''}`} size={18} />
                {unreadCount > 0 && (
                  <span className="notification-badge-count">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isBellDropdownOpen && (
                <div
                  className="bell-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: '46px',
                    right: 0,
                    width: '320px',
                    background: 'var(--glass-bg, rgba(18, 22, 31, 0.85))',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
                    borderRadius: '12px',
                    boxShadow: 'var(--box-shadow-glow, 0 10px 30px rgba(0,0,0,0.25))',
                    zIndex: 999,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid var(--glass-border)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span>{locale === 'en' ? 'Recent Notifications' : 'Thông báo gần đây'}</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await markAllAsRead();
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--color-primary, #ef4444)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                        }}
                      >
                        {locale === 'en' ? 'Mark all read' : 'Đọc tất cả'}
                      </button>
                    )}
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div
                        style={{
                          padding: '24px 16px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '0.8rem',
                        }}
                      >
                        {locale === 'en' ? 'No notifications yet' : 'Chưa có thông báo nào'}
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((notif) => (
                        <div
                          key={notif.id}
                          style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--glass-border)',
                            cursor: 'pointer',
                            background: notif.is_read ? 'transparent' : 'var(--hover-bg, rgba(255,255,255,0.02))',
                            position: 'relative',
                            transition: 'background 0.2s',
                          }}
                          onClick={() => {
                            setIsBellDropdownOpen(false);
                            if (notif.action_url) {
                              navigate(notif.action_url);
                            } else {
                              navigate(`/${role}/notifications`);
                            }
                            if (!notif.is_read) {
                              markAsRead(notif.id).catch(() => {});
                            }
                          }}
                        >
                          {!notif.is_read && (
                            <span
                              style={{
                                position: 'absolute',
                                left: '6px',
                                top: '16px',
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: 'var(--color-critical, #ef4444)',
                              }}
                            />
                          )}
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              color: 'var(--text-primary)',
                              marginBottom: '2px',
                              paddingLeft: notif.is_read ? 0 : '4px',
                            }}
                          >
                            {notif.title}
                          </div>
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-secondary)',
                              lineHeight: '1.3',
                              paddingLeft: notif.is_read ? 0 : '4px',
                            }}
                          >
                            {notif.message}
                          </div>
                          <div
                            style={{
                              fontSize: '0.65rem',
                              color: 'var(--text-muted)',
                              marginTop: '4px',
                              textAlign: 'right',
                            }}
                          >
                            {new Date(notif.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' })}{' '}
                            {new Date(notif.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsBellDropdownOpen(false);
                      navigate(`/${role}/notifications`);
                    }}
                    style={{
                      padding: '10px 16px',
                      background: 'var(--hover-bg, rgba(255,255,255,0.04))',
                      border: 'none',
                      borderTop: '1px solid var(--glass-border)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'center',
                      width: '100%',
                    }}
                  >
                    {locale === 'en' ? 'View All' : 'Xem tất cả thông báo'}
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleTheme}
              className="theme-toggle-btn"
              title={theme === 'dark' ? translateCommonLabel('theme_light', locale) : translateCommonLabel('theme_dark', locale)}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="role-user-card">
              {user?.avatar_url ? (
                <img 
                  src={getMediaUrl(user.avatar_url)} 
                  alt={user.full_name || 'Avatar'} 
                  className="avatar" 
                  style={{ objectFit: 'cover', width: '32px', height: '32px', borderRadius: '50%' }}
                />
              ) : (
                <div className="avatar">{(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}</div>
              )}
              <div className="user-info">
                <div className="user-name">{user?.full_name || 'Người dùng'}</div>
                <div className="user-role">{translateRoleLabel(role, locale)}</div>
              </div>
              <button className="logout-btn" onClick={handleLogout} title={translateCommonLabel('logout', locale)}>
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        <main className="role-content">{children}</main>

        <nav className="role-mobile-nav" aria-label={`${translateCommonLabel('all_features', locale)} ${translateRoleLabel(role, locale)}`}>
          {menuItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                type="button"
                className={`role-mobile-nav-item ${currentPath === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={18} />
                <span>{translateMenuLabel(item.label, locale)}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`role-mobile-nav-item ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={translateCommonLabel('all_features', locale)}
          >
            <MoreHorizontal size={18} />
            <span>{translateCommonLabel('more', locale)}</span>
          </button>
        </nav>
      </div>

      {isMobileMenuOpen && (
        <>
          <div className="mobile-drawer-overlay" onClick={() => setIsMobileMenuOpen(false)} />
          <div 
            id="mobile-navigation-drawer"
            className="mobile-drawer" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="drawer-title"
          >
            <div className="mobile-drawer-handle" />
            <div className="mobile-drawer-header">
              <h2 id="drawer-title" className="mobile-drawer-title">{translateCommonLabel('all_features', locale)}</h2>
              <button 
                type="button" 
                className="mobile-drawer-close-btn" 
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label={translateCommonLabel('close_menu', locale)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mobile-drawer-sections">
              {Object.entries(groupedMenuItems).map(([groupKey, items]) => {
                const hasHeader = groupKey !== 'none' && groupKey !== '';
                
                if (!hasHeader || items.length <= 1) {
                  return (
                    <div key={groupKey} className="mobile-drawer-flat-items">
                      {items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentPath === item.path;
                        return (
                          <button
                            key={item.path}
                            type="button"
                            className={`mobile-drawer-item ${isActive ? 'active' : ''}`}
                            onClick={() => {
                              navigate(item.path);
                              setIsMobileMenuOpen(false);
                            }}
                          >
                            <Icon size={20} />
                            <span>{translateMenuLabel(item.label, locale)}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                const isExpanded = !!expandedGroups[groupKey];
                const GroupIcon = items[0]?.icon || Activity;

                return (
                  <div key={groupKey} className="mobile-drawer-section">
                    <button
                      type="button"
                      className="mobile-drawer-section-toggle"
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <div className="group-toggle-left">
                        <GroupIcon size={18} />
                        <span>{translateCommonLabel(groupKey, locale)}</span>
                      </div>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    
                    {isExpanded && (
                      <div className="mobile-drawer-grid">
                        {items.map((item) => {
                          const Icon = item.icon;
                          const isActive = currentPath === item.path;
                          return (
                            <button
                              key={item.path}
                              type="button"
                              className={`mobile-drawer-item ${isActive ? 'active' : ''}`}
                              onClick={() => {
                                navigate(item.path);
                                setIsMobileMenuOpen(false);
                              }}
                            >
                              <Icon size={20} />
                              <span>{translateMenuLabel(item.label, locale)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Modal xác nhận đăng xuất ── */}
      {showLogoutModal && (
        <div
          className="modal-overlay logout-modal-overlay"
          onClick={() => { if (!loggingOut) setShowLogoutModal(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
        >
          <div
            className="modal-content logout-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logout-modal-icon-wrap">
              <div className="logout-modal-icon">
                <AlertTriangle size={28} />
              </div>
            </div>
            <h3 id="logout-modal-title" className="logout-modal-title">
              {locale === 'en' ? 'Confirm Logout' : 'Xác nhận đăng xuất'}
            </h3>
            <p className="logout-modal-body">
              {locale === 'en'
                ? 'Are you sure you want to log out of CardioGuard AI?'
                : 'Bạn có chắc chắn muốn đăng xuất khỏi CardioGuard AI không?'}
            </p>
            {logoutError && (
              <div className="logout-modal-error">{logoutError}</div>
            )}
            <div className="logout-modal-actions">
              <button
                type="button"
                className="btn btn-secondary logout-cancel-btn"
                onClick={() => setShowLogoutModal(false)}
                disabled={loggingOut}
              >
                {locale === 'en' ? 'Cancel' : 'Hủy'}
              </button>
              <button
                type="button"
                className="btn logout-confirm-btn"
                onClick={confirmLogoutAction}
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <><Loader2 size={15} className="spin-icon" /> {locale === 'en' ? 'Logging out...' : 'Đang đăng xuất...'}</>
                ) : (
                  <><LogOut size={15} /> {locale === 'en' ? 'Log out' : 'Đăng xuất'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** RoleLayout được cấu hình sẵn cho các tuyến đường admin */
export const AdminLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="admin" />;
/** RoleLayout được cấu hình sẵn cho các tuyến đường bác sĩ */
export const DoctorLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="doctor" />;
/** RoleLayout được cấu hình sẵn cho các tuyến đường bệnh nhân */
export const PatientLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="patient" />;
