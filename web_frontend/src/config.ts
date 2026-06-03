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
const normalizedBakedApiUrl = bakedApiUrl && (!isPlaceholderUrl(bakedApiUrl)) && (isLocalhost || !isLoopbackUrl(bakedApiUrl))
  ? bakedApiUrl
  : undefined;
const normalizedBakedWsUrl = bakedWsUrl && (!isPlaceholderUrl(bakedWsUrl)) && (isLocalhost || !isLoopbackUrl(bakedWsUrl))
  ? bakedWsUrl
  : undefined;
const runtimeDerivedApiUrl = deriveApiUrlFromWsUrl(runtimeWsUrl);
const bakedDerivedApiUrl = deriveApiUrlFromWsUrl(normalizedBakedWsUrl);
const runtimeDerivedWsUrl = deriveWsUrlFromApiUrl(runtimeApiUrl);
const bakedDerivedWsUrl = deriveWsUrlFromApiUrl(normalizedBakedApiUrl);

export const API_URL =
  (!isPlaceholderUrl(runtimeApiUrl) ? runtimeApiUrl : undefined) ||
  normalizedBakedApiUrl ||
  runtimeDerivedApiUrl ||
  bakedDerivedApiUrl ||
  (isLocalhost ? 'http://localhost:8000' : '/api');

export const WS_URL =
  (!isPlaceholderUrl(runtimeWsUrl) ? runtimeWsUrl : undefined) ||
  normalizedBakedWsUrl ||
  runtimeDerivedWsUrl ||
  bakedDerivedWsUrl ||
  (isLocalhost ? 'ws://localhost:8000/ws/realtime' : '/ws/realtime');
