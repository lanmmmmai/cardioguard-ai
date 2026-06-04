let googleIdentityScriptPromise: Promise<void> | null = null;

const GOOGLE_SCRIPT_ID = 'google-identity-services';

export const loadGoogleIdentityScript = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In chỉ hoạt động trên trình duyệt'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!googleIdentityScriptPromise) {
    googleIdentityScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.getElementById(GOOGLE_SCRIPT_ID) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => {
          googleIdentityScriptPromise = null;
          reject(new Error('Không tải được Google Identity Services'));
        }, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        googleIdentityScriptPromise = null;
        reject(new Error('Không tải được Google Identity Services'));
      };
      document.head.appendChild(script);
    });
  }

  return googleIdentityScriptPromise;
};
