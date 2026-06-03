/**
 * Tệp: CardioGuard AI – Bố cục shell ứng dụng dựa trên vai trò
 * Mục đích: Cung cấp vùng sidebar + tiêu đề + nội dung chung cho tất cả
 *           vai trò đã xác thực. Bao gồm sidebar phản hồi, điều hướng dưới cùng
 *           trên thiết bị di động, drawer di động, chuyển đổi chủ đề, thẻ người dùng
 *           và trạng thái kết nối.
 * Luồng xử lý: 1. Nhận vai trò, đường dẫn, điều hướng, chủ đề và thành phần con.
 *              2. Hiển thị sidebar dọc (máy tính) + điều hướng dưới cùng (di động).
 *              3. Trên di động, drawer trượt lên hiển thị menu đầy đủ.
 *              4. Tiêu đề hiển thị nhãn vai trò, tiêu đề trang, nút chủ đề, thẻ người dùng.
 * Quan hệ:
 *   - sử dụng: AuthContext (user, logout), roleMenus, routeMeta (pageTitles)
 *   - xuất AdminLayout, DoctorLayout, PatientLayout cho App.tsx
 */

import React, { useState, useEffect } from 'react';
import { Activity, LogOut, Menu, Moon, Sun, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { type UserRole } from '../auth/roles';
import { roleMenus } from '../navigation/roleMenus';
import { API_URL } from '../config';
import { translateCommonLabel, translateMenuLabel, translateRoleLabel, useLocale } from '../i18n/locale';

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
 * và drawer trượt lên cho tất cả các mục điều hướng.
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
  const menuItems = roleMenus[role];
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getMediaUrl = (path?: string | null) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}?token=${accessToken}`;
  };

  const confirmLogout = () => {
    return window.confirm(locale === 'en' ? 'Do you want to log out?' : 'Bạn muốn đăng xuất?');
  };

  // Đóng drawer di động khi nhấn phím Escape để hỗ trợ trợ năng
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    if (!confirmLogout()) return;
    logout();
    if (role === 'admin') {
      navigate('/login-admin', true);
    } else if (role === 'doctor') {
      navigate('/login-doctor', true);
    } else {
      navigate('/login', true);
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
          {menuItems.map((item) => {
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
            <div className="mobile-drawer-grid">
              {menuItems.map((item) => {
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
          </div>
        </>
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
