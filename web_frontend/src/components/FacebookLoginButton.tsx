/**
 * CardioGuard AI — Nút đăng nhập bằng Facebook
 *
 * Sử dụng Facebook JS SDK để lấy access_token, sau đó gọi callback onAccessToken.
 * Không xử lý lưu session — component cha chịu trách nhiệm đó.
 */

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loginWithFacebook } from '../lib/facebookAuth';

interface FacebookLoginButtonProps {
  appId: string;
  role?: 'patient' | 'doctor' | 'admin';
  disabled?: boolean;
  caption?: string;
  onAccessToken: (token: string) => Promise<void>;
}

const FacebookIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
  </svg>
);

export const FacebookLoginButton: React.FC<FacebookLoginButtonProps> = ({
  appId,
  role: _role,
  disabled = false,
  caption = 'Tiếp tục với Facebook',
  onAccessToken,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!appId) return null;

  const handleClick = async () => {
    if (loading || disabled) return;
    setError(null);
    setLoading(true);
    try {
      const accessToken = await loginWithFacebook(appId);
      await onAccessToken(accessToken);
    } catch (err: any) {
      setError(err?.message || 'Đăng nhập Facebook thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <button
        type="button"
        className="facebook-login-btn"
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label={caption}
        aria-busy={loading}
      >
        {loading ? (
          <Loader2 size={18} className="spin-icon" />
        ) : (
          <FacebookIcon size={18} />
        )}
        <span>{loading ? 'Đang kết nối Facebook...' : caption}</span>
      </button>

      {error && (
        <div
          style={{
            textAlign: 'center',
            color: 'var(--color-critical)',
            fontSize: '0.78rem',
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};
