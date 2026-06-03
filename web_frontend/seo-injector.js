export const DEFAULT_SEO = {
  title: 'CardioGuard AI - Giám sát sức khỏe tim mạch thời gian thực',
  description:
    'CardioGuard AI - Hệ thống giám sát sức khỏe tim mạch thời gian thực. Theo dõi nhịp tim, SpO2, huyết áp và điện tâm đồ thông qua các cảm biến IoT đeo thông minh.',
  image: 'https://giatky.site/images/preview.jpg',
  siteName: 'CardioGuard AI',
};

export function getPublicSiteUrl() {
  return (process.env.PUBLIC_SITE_URL || 'https://giatky.site').replace(/\/$/, '');
}

export function getBackendBaseUrl() {
  const url = (
    process.env.BACKEND_API_URL ||
    process.env.API_URL ||
    'https://cardioguard-ai-backend.onrender.com/api'
  ).replace(/\/$/, '');
  return url.endsWith('/api') ? url : `${url}/api`;
}

export function getBackendWsUrl() {
  return (
    process.env.BACKEND_WS_URL ||
    process.env.VITE_WS_URL ||
    'wss://cardioguard-ai-backend.onrender.com/ws/realtime'
  ).replace(/\/$/, '');
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function normalizePagePath(value = '/') {
  const raw = String(value || '/').split('?')[0].split('#')[0] || '/';
  let pagePath = raw.startsWith('/') ? raw : `/${raw}`;
  if (pagePath.length > 1 && pagePath.endsWith('/')) {
    pagePath = pagePath.slice(0, -1);
  }
  return pagePath || '/';
}

function firstHeaderValue(value) {
  if (Array.isArray(value)) return value[0];
  return String(value || '').split(',')[0].trim();
}

export function buildPublicUrl(req, pagePath) {
  const publicSiteUrl = getPublicSiteUrl();
  const forwardedProto = firstHeaderValue(req.headers?.['x-forwarded-proto']);
  const forwardedHost = firstHeaderValue(req.headers?.['x-forwarded-host']);
  const proto = forwardedProto || req.protocol || 'https';
  const host = forwardedHost || req.headers?.host || req.get?.('host') || new URL(publicSiteUrl).host;

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `${publicSiteUrl}${pagePath}`;
  }

  return `${proto}://${host}${pagePath}`;
}

function imageMimeType(imageUrl = '') {
  const pathname = (() => {
    try {
      return new URL(imageUrl).pathname;
    } catch {
      return imageUrl;
    }
  })().toLowerCase();

  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function normalizeSeoPayload(data, fullUrl) {
  const targetUrl = data?.url || fullUrl;
  return {
    title: data?.title || DEFAULT_SEO.title,
    description: data?.description || DEFAULT_SEO.description,
    image: data?.image_url || data?.image || DEFAULT_SEO.image,
    url: targetUrl,
    siteName: data?.site_name || DEFAULT_SEO.siteName,
  };
}

export async function getSeoByPath(pagePath, fullUrl) {
  try {
    const params = new URLSearchParams({ path: pagePath });
    const response = await fetch(`${getBackendBaseUrl()}/cms/domain-links/resolve?${params.toString()}`);

    if (!response.ok) {
      return normalizeSeoPayload(null, fullUrl);
    }

    const data = await response.json();
    return normalizeSeoPayload(data, fullUrl);
  } catch (err) {
    console.error('Backend SEO resolve failed:', err);
    return normalizeSeoPayload(null, fullUrl);
  }
}

export function injectSeoIntoHtml(html, seo) {
  const seoUrl = seo.url || getPublicSiteUrl();
  const seoImage = seo.image || DEFAULT_SEO.image;
  const replacements = {
    __SEO_TITLE__: escapeHtml(seo.title || DEFAULT_SEO.title),
    __SEO_DESCRIPTION__: escapeHtml(seo.description || DEFAULT_SEO.description),
    __SEO_IMAGE__: escapeHtml(seoImage),
    __SEO_IMAGE_TYPE__: escapeHtml(imageMimeType(seoImage)),
    __SEO_SITE_NAME__: escapeHtml(seo.siteName || DEFAULT_SEO.siteName),
    __SEO_URL__: escapeHtml(seoUrl),
    __CARDIOGUARD_API_URL_PLACEHOLDER__: escapeHtml(getBackendBaseUrl()),
    __CARDIOGUARD_WS_URL_PLACEHOLDER__: escapeHtml(getBackendWsUrl()),
  };

  return Object.entries(replacements).reduce(
    (currentHtml, [token, value]) => currentHtml.replaceAll(token, value),
    html
  );
}
