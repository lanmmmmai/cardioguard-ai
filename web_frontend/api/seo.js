import fs from 'fs';
import path from 'path';
import {
  buildPublicUrl,
  getSeoByPath,
  injectSeoIntoHtml,
  normalizePagePath,
} from '../seo-injector.js';

const INDEX_PATH_CANDIDATES = [
  path.join(process.cwd(), 'dist', 'index.html'),
  path.join(process.cwd(), 'index.html'),
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

export default async function handler(req, res) {
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end('Method Not Allowed');
    return;
  }

  try {
    const html = readIndexHtml();
    const requestedPath = Array.isArray(req.query?.path) ? req.query.path[0] : req.query?.path;
    const pagePath = normalizePagePath(requestedPath || req.url || '/');
    const fullUrl = buildPublicUrl(req, pagePath);
    const seo = await getSeoByPath(pagePath, fullUrl);
    const finalHtml = injectSeoIntoHtml(html, seo);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.statusCode = 200;
    res.end(req.method === 'HEAD' ? '' : finalHtml);
  } catch (err) {
    console.error('SEO function failed:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}
