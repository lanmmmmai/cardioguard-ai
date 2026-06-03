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

export const API_URL =
  (!isPlaceholderUrl(runtimeApiUrl) ? runtimeApiUrl : undefined) ||
  normalizedBakedApiUrl ||
  (isLocalhost ? 'http://localhost:8000' : '/api');

export const WS_URL =
  (!isPlaceholderUrl(runtimeWsUrl) ? runtimeWsUrl : undefined) ||
  normalizedBakedWsUrl ||
  (isLocalhost ? 'ws://localhost:8000/ws/realtime' : '/ws/realtime');
