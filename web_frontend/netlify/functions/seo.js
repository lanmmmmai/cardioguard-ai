import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildPublicUrl,
  getSeoByPath,
  injectSeoIntoHtml,
  normalizePagePath,
} from '../../seo-injector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_PATH_CANDIDATES = [
  path.join(process.cwd(), 'dist', 'index.html'),
  path.join(process.cwd(), 'web_frontend', 'dist', 'index.html'),
  path.join(__dirname, '..', '..', 'dist', 'index.html'),
];

let cachedIndexHtml = '';

async function readIndexHtml(origin) {
  if (cachedIndexHtml) return cachedIndexHtml;

  const indexPath = INDEX_PATH_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (indexPath) {
    cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
    return cachedIndexHtml;
  }

  if (!origin) {
    throw new Error('Index HTML not found. Please build frontend first.');
  }

  const response = await fetch(new URL('/index.html', origin));
  if (!response.ok) {
    throw new Error(`Unable to load index HTML from ${origin}`);
  }

  cachedIndexHtml = await response.text();
  return cachedIndexHtml;
}

export const handler = async (event) => {
  if (!['GET', 'HEAD'].includes(event.httpMethod || 'GET')) {
    return {
      statusCode: 405,
      headers: { Allow: 'GET, HEAD' },
      body: 'Method Not Allowed',
    };
  }

  try {
    const rawPath = event.queryStringParameters?.path || event.path || '/';
    const pagePath = normalizePagePath(rawPath);
    const mockReq = {
      headers: event.headers || {},
      protocol: event.headers?.['x-forwarded-proto'] || 'https',
      get: (name) => event.headers?.[String(name).toLowerCase()],
    };
    const fullUrl = buildPublicUrl(mockReq, pagePath);
    const html = await readIndexHtml(new URL(fullUrl).origin);
    const seo = await getSeoByPath(pagePath, fullUrl);
    const finalHtml = injectSeoIntoHtml(html, seo, mockReq);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
      body: finalHtml,
    };
  } catch (err) {
    console.error('Netlify SEO function failed:', err);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
  }
};
