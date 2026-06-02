import React, { useState, useEffect } from 'react';
import { Activity, LogOut, Menu, Moon, Sun, MoreHorizontal, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { roleLabel, type UserRole } from '../auth/roles';
import { roleMenus } from '../navigation/roleMenus';
import { API_URL } from '../config';

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
  admin: 'CardioGuard Admin',
  doctor: 'Doctor Workspace',
  patient: 'Patient Home',
};

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
  const menuItems = roleMenus[role];
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getMediaUrl = (path?: string | null) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `${API_URL}${path}?token=${accessToken}`;
  };

  // Close mobile drawer when pressing Escape key for accessibility
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
            <div className="role-brand-subtitle">{layoutTitle[role]}</div>
          </div>
        </div>

        <nav className="role-menu" aria-label={`Menu ${roleLabel[role]}`}>
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
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button type="button" className="role-menu-item logout" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <div className="role-main">
        <header className="role-header">
          <div className="role-header-left">
            <Menu size={20} className="role-mobile-icon" onClick={() => setIsMobileMenuOpen(true)} />
            <div>
              <div className="role-header-kicker">{roleLabel[role]}</div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {layoutTitle[role]}
                <span 
                  className={`connection-status-dot ${isConnected ? 'connected' : 'disconnected'}`} 
                  title={isConnected ? 'Đang kết nối realtime (Trực tuyến)' : 'Mất kết nối realtime (Ngoại tuyến)'}
                />
              </h1>
            </div>
          </div>

          <div className="role-header-actions">
            <button
              type="button"
              onClick={onToggleTheme}
              className="theme-toggle-btn"
              title={theme === 'dark' ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
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
                <div className="user-role">{roleLabel[role]}</div>
              </div>
              <button className="logout-btn" onClick={handleLogout} title="Đăng xuất">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        <main className="role-content">{children}</main>

        <nav className="role-mobile-nav" aria-label={`Mobile menu ${roleLabel[role]}`}>
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
                <span>{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={`role-mobile-nav-item ${isMobileMenuOpen ? 'active' : ''}`}
            onClick={() => setIsMobileMenuOpen(true)}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label="Mở tất cả menu chức năng"
          >
            <MoreHorizontal size={18} />
            <span>Thêm</span>
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
              <h2 id="drawer-title" className="mobile-drawer-title">Tất cả chức năng</h2>
              <button 
                type="button" 
                className="mobile-drawer-close-btn" 
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Đóng menu"
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
                    <span>{item.label}</span>
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

export const AdminLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="admin" />;
export const DoctorLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="doctor" />;
export const PatientLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="patient" />;

