import React from 'react';
import { useBrowserPath } from '../hooks/useBrowserPath';

const LINKS = [
  { path: '/about', label: 'Giới thiệu' },
  { path: '/privacy', label: 'Chính sách bảo mật' },
  { path: '/terms', label: 'Điều khoản dịch vụ' },
  { path: '/data-deletion', label: 'Yêu cầu xóa dữ liệu' },
];

export const LegalFooterLinks: React.FC = () => {
  const { navigate } = useBrowserPath();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
      {LINKS.map((link, index) => (
        <React.Fragment key={link.path}>
          <a
            href={link.path}
            style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            onClick={(e) => {
              e.preventDefault();
              navigate(link.path);
            }}
          >
            {link.label}
          </a>
          {index < LINKS.length - 1 && <span>•</span>}
        </React.Fragment>
      ))}
    </div>
  );
};
