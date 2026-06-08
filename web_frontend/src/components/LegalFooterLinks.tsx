/**
 * CardioGuard AI — Public legal footer navigation links.
 *
 * Purpose:
 *   Provide public SPA links for company information, privacy policy,
 *   terms of service, and data deletion request pages on auth screens.
 */
import React from 'react';
import { useBrowserPath } from '../hooks/useBrowserPath';

const LINKS = [
  { path: '/gioi-thieu', label: 'Giới thiệu' },
  { path: '/chinh-sach-bao-mat', label: 'Chính sách bảo mật' },
  { path: '/dieu-khoan-dich-vu', label: 'Điều khoản dịch vụ' },
  { path: '/yeu-cau-xoa-du-lieu', label: 'Yêu cầu xóa dữ liệu' },
];

/**
 * Render footer links for public legal pages on login and registration screens.
 *
 * @returns Inline legal footer navigation
 */
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
