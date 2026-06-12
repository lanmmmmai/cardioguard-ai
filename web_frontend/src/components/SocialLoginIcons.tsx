/**
 * SocialLoginIcons — dạng icon tròn dùng chung cho Login và Register.
 *
 * Thay thế 2 nút dài Google/Facebook bằng 2 icon tròn cạnh nhau.
 * Giữ nguyên toàn bộ logic xác thực — chỉ thay phần UI.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { loadGoogleIdentityScript } from '../lib/googleIdentity';
import { loginWithFacebook } from '../lib/facebookAuth';

/* ── SVG icons ───────────────────────────────────────────── */
const GoogleIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

const FacebookIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.884v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
  </svg>
);

/* ── Props ───────────────────────────────────────────────── */
interface SocialLoginIconsProps {
  showGoogle: boolean;
  showFacebook: boolean;
  googleClientId: string;
  facebookAppId: string;
  facebookRole?: 'patient' | 'doctor' | 'admin';
  disabled?: boolean;
  label?: string;
  onGoogleCredential: (idToken: string) => Promise<void>;
  onFacebookToken: (accessToken: string) => Promise<void>;
}

/* ── Google icon button ──────────────────────────────────── */
const GoogleIconButton: React.FC<{
  clientId: string;
  disabled?: boolean;
  onCredential: (idToken: string) => Promise<void>;
}> = ({ clientId, disabled = false, onCredential }) => {
  const onCredentialRef = useRef(onCredential);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || initialized.current) return;
    let active = true;

    loadGoogleIdentityScript()
      .then(() => {
        if (!active || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            const credential = response.credential?.trim();
            if (!credential) {
              setError('Không nhận được mã xác thực từ Google.');
              return;
            }
            setError(null);
            setLoading(true);
            try {
              await onCredentialRef.current(credential);
            } catch (err: any) {
              setError(err?.message || 'Đăng nhập Google thất bại.');
            } finally {
              if (active) setLoading(false);
            }
          },
        });
        initialized.current = true;
      })
      .catch(() => {/* silent — user will see error on click */});

    return () => { active = false; };
  }, [clientId]);

  const handleClick = async () => {
    if (disabled || loading) return;
    setError(null);
    if (!window.google?.accounts?.id) {
      setError('Google Sign-In chưa tải xong. Vui lòng thử lại.');
      return;
    }
    window.google.accounts.id.prompt();
  };

  return (
    <div className="social-icon-wrapper">
      <button
        type="button"
        className="social-icon-btn social-icon-btn--google"
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label="Đăng nhập bằng Google"
        title="Đăng nhập bằng Google"
      >
        {loading ? <Loader2 size={20} className="spin-icon" /> : <GoogleIcon size={20} />}
      </button>
      {error && <div className="social-icon-error">{error}</div>}
    </div>
  );
};

/* ── Facebook icon button ────────────────────────────────── */
const FacebookIconButton: React.FC<{
  appId: string;
  role?: 'patient' | 'doctor' | 'admin';
  disabled?: boolean;
  onAccessToken: (token: string) => Promise<void>;
}> = ({ appId, disabled = false, onAccessToken }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled || loading) return;
    setError(null);

    if (!appId?.trim()) {
      setError('Facebook Login chưa được cấu hình (VITE_FACEBOOK_APP_ID trống).');
      return;
    }

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
    <div className="social-icon-wrapper">
      <button
        type="button"
        className="social-icon-btn social-icon-btn--facebook"
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label="Đăng nhập bằng Facebook"
        title={!appId?.trim() ? 'Facebook Login chưa được cấu hình' : 'Đăng nhập bằng Facebook'}
      >
        {loading ? (
          <Loader2 size={20} className="spin-icon" />
        ) : (
          <>
            <FacebookIcon size={20} />
            {!appId?.trim() && (
              <AlertCircle size={10} className="social-icon-badge-warn" aria-hidden="true" />
            )}
          </>
        )}
      </button>
      {error && <div className="social-icon-error">{error}</div>}
    </div>
  );
};

/* ── Main export ─────────────────────────────────────────── */
export const SocialLoginIcons: React.FC<SocialLoginIconsProps> = ({
  showGoogle,
  showFacebook,
  googleClientId,
  facebookAppId,
  facebookRole,
  disabled = false,
  label = 'Hoặc tiếp tục với',
  onGoogleCredential,
  onFacebookToken,
}) => {
  if (!showGoogle && !showFacebook) return null;

  return (
    <div className="social-icons-section">
      <div className="social-icons-divider">
        <span className="social-icons-line" />
        <span className="social-icons-label">{label}</span>
        <span className="social-icons-line" />
      </div>
      <div className="social-icons-row">
        {showGoogle && (
          <GoogleIconButton
            clientId={googleClientId}
            disabled={disabled}
            onCredential={onGoogleCredential}
          />
        )}
        {showFacebook && (
          <FacebookIconButton
            appId={facebookAppId}
            role={facebookRole}
            disabled={disabled}
            onAccessToken={onFacebookToken}
          />
        )}
      </div>
    </div>
  );
};
