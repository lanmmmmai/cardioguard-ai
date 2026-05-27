import React from 'react';
import { Activity, LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { roleLabel, type UserRole } from '../auth/roles';
import { roleMenus } from '../navigation/roleMenus';

interface RoleLayoutProps {
  role: UserRole;
  currentPath: string;
  navigate: (path: string, replace?: boolean) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  children: React.ReactNode;
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
}) => {
  const { user, logout } = useAuth();
  const menuItems = roleMenus[role];

  const handleLogout = () => {
    logout();
    navigate('/login', true);
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
            <Menu size={20} className="role-mobile-icon" />
            <div>
              <div className="role-header-kicker">{roleLabel[role]}</div>
              <h1>{layoutTitle[role]}</h1>
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
              <div className="avatar">{(user?.full_name || user?.email || '?').charAt(0).toUpperCase()}</div>
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
          {menuItems.slice(0, 5).map((item) => {
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
        </nav>
      </div>
    </div>
  );
};

export const AdminLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="admin" />;
export const DoctorLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="doctor" />;
export const PatientLayout = (props: Omit<RoleLayoutProps, 'role'>) => <RoleLayout {...props} role="patient" />;
