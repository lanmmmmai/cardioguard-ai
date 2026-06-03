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

function readIndexHtml() {
  if (cachedIndexHtml) return cachedIndexHtml;

  const indexPath = INDEX_PATH_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!indexPath) {
    throw new Error('Index HTML not found. Please build frontend first.');
  }

  cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
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
    const html = readIndexHtml();
    const rawPath = event.queryStringParameters?.path || event.path || '/';
    const pagePath = normalizePagePath(rawPath);
    const fullUrl = buildPublicUrl(
      {
        headers: event.headers || {},
        protocol: event.headers?.['x-forwarded-proto'] || 'https',
        get: (name) => event.headers?.[String(name).toLowerCase()],
      },
      pagePath
    );
    const seo = await getSeoByPath(pagePath, fullUrl);
    const finalHtml = injectSeoIntoHtml(html, seo);

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
