import React, { useEffect, useRef, useState } from 'react';
import { Chrome, Loader2 } from 'lucide-react';
import { loadGoogleIdentityScript } from '../lib/googleIdentity';

interface GoogleLoginButtonProps {
  clientId: string;
  disabled?: boolean;
  buttonText?: 'signin_with' | 'signup_with' | 'continue_with';
  caption?: string;
  successLabel?: string;
  onCredential: (idToken: string) => Promise<void>;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  clientId,
  disabled = false,
  buttonText = 'continue_with',
  caption = 'Đăng nhập nhanh bằng tài khoản Google',
  successLabel = 'Đang xác thực với Google...',
  onCredential,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCredentialRef = useRef(onCredential);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId || !containerRef.current) {
      return;
    }

    let active = true;

    const renderButton = async () => {
      try {
        await loadGoogleIdentityScript();
        if (!active || !containerRef.current || !window.google?.accounts?.id) {
          return;
        }

        const width = Math.max(240, Math.min(containerRef.current.clientWidth || 360, 420));
        containerRef.current.innerHTML = '';

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
              if (active) {
                setLoading(false);
              }
            }
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline',
          size: 'large',
          text: buttonText,
          shape: 'rectangular',
          logo_alignment: 'left',
          width,
        });
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Không tải được Google Sign-In.');
        }
      }
    };

    renderButton();

    return () => {
      active = false;
    };
  }, [clientId, buttonText]);

  if (!clientId) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          opacity: disabled || loading ? 0.65 : 1,
          pointerEvents: disabled || loading ? 'none' : 'auto',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
        {loading ? <Loader2 className="beat-animated" size={14} /> : <Chrome size={14} />}
        <span>{loading ? successLabel : caption}</span>
      </div>
      {error && (
        <div style={{ textAlign: 'center', color: 'var(--color-critical)', fontSize: '0.78rem', lineHeight: 1.4 }}>
          {error}
        </div>
      )}
    </div>
  );
};
