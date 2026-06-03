/**
 * Tệp: CardioGuard AI – Cấu hình dựa trên môi trường
 * Mục đích: Tập trung các hằng số runtime được đọc từ biến môi trường Vite
 *           với giá trị dự phòng an toàn cho phát triển cục bộ.
 * Luồng xử lý: Các giá trị import.meta.env.VITE_* được Vite inject tại thời điểm
 *              build; nếu không có, giá trị mặc định cứng trỏ đến backend dev cục bộ.
 * Quan hệ:
 *   - Được sử dụng bởi: AuthContext (API_URL), useWebSocket (WS_URL), cmsApi (API_URL)
 */

declare global {
  interface Window {
    __CARDIOGUARD_API_URL__?: string;
    __CARDIOGUARD_WS_URL__?: string;
  }
}

const runtimeApiUrl = typeof window !== 'undefined' ? window.__CARDIOGUARD_API_URL__ : undefined;
const runtimeWsUrl = typeof window !== 'undefined' ? window.__CARDIOGUARD_WS_URL__ : undefined;
const isPlaceholderUrl = (value?: string) => Boolean(value && value.startsWith('__CARDIOGUARD_'));
const isLoopbackUrl = (value?: string) => Boolean(
  value && /^(https?:\/\/|wss?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(value)
);
const isRelativeApiPath = (value?: string) => Boolean(value && value.startsWith('/') && !value.startsWith('//'));
const isDockerInternalUrl = (value?: string) => {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname;
    return !hostname.includes('.') && hostname !== 'localhost';
  } catch {
    return false;
  }
};
const isUsableApiUrl = (value?: string) => Boolean(
  value &&
  !isPlaceholderUrl(value) &&
  (typeof window === 'undefined' || !isDockerInternalUrl(value)) &&
  (!isRelativeApiPath(value) || typeof window === 'undefined' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  (!isLoopbackUrl(value) || typeof window === 'undefined' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
);
const isUsableWsUrl = (value?: string) => Boolean(
  value &&
  !isPlaceholderUrl(value) &&
  (typeof window === 'undefined' || !isDockerInternalUrl(value)) &&
  (!isLoopbackUrl(value) || typeof window === 'undefined' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
);
const deriveApiUrlFromWsUrl = (wsUrl?: string) => {
  if (!wsUrl || isPlaceholderUrl(wsUrl)) return undefined;
  try {
    const parsed = new URL(wsUrl);
    const protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
    return `${protocol}//${parsed.host}`;
  } catch {
    return undefined;
  }
};
const deriveWsUrlFromApiUrl = (apiUrl?: string) => {
  if (!apiUrl || isPlaceholderUrl(apiUrl)) return undefined;
  try {
    const parsed = new URL(apiUrl);
    const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${parsed.host}/ws/realtime`;
  } catch {
    return undefined;
  }
};
const isLocalhost = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const bakedApiUrl = import.meta.env.VITE_API_URL;
const bakedWsUrl = import.meta.env.VITE_WS_URL;
const savedApiUrl = isLocalhost && typeof window !== 'undefined' ? window.localStorage.getItem('settings_api_url') || undefined : undefined;
const savedWsUrl = isLocalhost && typeof window !== 'undefined' ? window.localStorage.getItem('settings_ws_url') || undefined : undefined;
const normalizedBakedApiUrl = isUsableApiUrl(bakedApiUrl) ? bakedApiUrl : undefined;
const normalizedBakedWsUrl = isUsableWsUrl(bakedWsUrl) ? bakedWsUrl : undefined;
const normalizedSavedApiUrl = isUsableApiUrl(savedApiUrl) ? savedApiUrl : undefined;
const normalizedSavedWsUrl = isUsableWsUrl(savedWsUrl) ? savedWsUrl : undefined;
const runtimeDerivedApiUrl = isUsableApiUrl(deriveApiUrlFromWsUrl(runtimeWsUrl)) ? deriveApiUrlFromWsUrl(runtimeWsUrl) : undefined;
const bakedDerivedApiUrl = isUsableApiUrl(deriveApiUrlFromWsUrl(normalizedBakedWsUrl || normalizedSavedWsUrl)) ? deriveApiUrlFromWsUrl(normalizedBakedWsUrl || normalizedSavedWsUrl) : undefined;
const savedDerivedApiUrl = isUsableApiUrl(deriveApiUrlFromWsUrl(normalizedSavedWsUrl)) ? deriveApiUrlFromWsUrl(normalizedSavedWsUrl) : undefined;
const runtimeDerivedWsUrl = isUsableWsUrl(deriveWsUrlFromApiUrl(runtimeApiUrl)) ? deriveWsUrlFromApiUrl(runtimeApiUrl) : undefined;
const bakedDerivedWsUrl = isUsableWsUrl(deriveWsUrlFromApiUrl(normalizedBakedApiUrl || normalizedSavedApiUrl)) ? deriveWsUrlFromApiUrl(normalizedBakedApiUrl || normalizedSavedApiUrl) : undefined;
const savedDerivedWsUrl = isUsableWsUrl(deriveWsUrlFromApiUrl(normalizedSavedApiUrl)) ? deriveWsUrlFromApiUrl(normalizedSavedApiUrl) : undefined;

const ensureEndsWithApi = (url?: string) => {
  if (!url) return undefined;
  if (isPlaceholderUrl(url)) return url;
  const trimmed = url.replace(/\/$/, '');
  if (!trimmed.endsWith('/api')) {
    return `${trimmed}/api`;
  }
  return trimmed;
};

/** URL cơ sở của REST API – dự phòng về localhost:8000 */
export const API_URL = ensureEndsWithApi(
  runtimeDerivedApiUrl ||
  (!isPlaceholderUrl(runtimeApiUrl) && isUsableApiUrl(runtimeApiUrl) ? runtimeApiUrl : undefined) ||
  normalizedSavedApiUrl ||
  normalizedBakedApiUrl ||
  savedDerivedApiUrl ||
  bakedDerivedApiUrl ||
  (isLocalhost ? 'http://localhost:8000/api' : 'https://cardioguard-ai-backend.onrender.com/api')
) as string;

/** Điểm cuối WebSocket cho dữ liệu telemetry thời gian thực */
export const WS_URL =
  runtimeDerivedWsUrl ||
  (!isPlaceholderUrl(runtimeWsUrl) && isUsableWsUrl(runtimeWsUrl) ? runtimeWsUrl : undefined) ||
  normalizedSavedWsUrl ||
  normalizedBakedWsUrl ||
  savedDerivedWsUrl ||
  bakedDerivedWsUrl ||
  (isLocalhost ? 'ws://localhost:8000/ws/realtime' : 'wss://cardioguard-ai-backend.onrender.com/ws/realtime');

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = API_URL.replace(/\/$/, '');

  if (normalizedPath === '/api') {
    return base;
  }

  if (normalizedPath.startsWith('/api/') && base.endsWith('/api')) {
    return `${base}${normalizedPath.slice(4)}`;
  }

  return `${base}${normalizedPath}`;
};
