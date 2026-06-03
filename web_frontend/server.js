import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import {
  buildPublicUrl,
  getSeoByPath,
  injectSeoIntoHtml,
  normalizePagePath,
} from './seo-injector.js';

// Load environment variables for local testing
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const DIST_PATH = path.join(__dirname, 'dist');
const INDEX_PATH = path.join(DIST_PATH, 'index.html');

// Serve static assets with long-term caching
app.use('/assets', express.static(path.join(DIST_PATH, 'assets'), {
  maxAge: '1y',
  immutable: true
}));

// Serve other static files in dist
app.use(express.static(DIST_PATH, {
  index: false // Let the wildcard route handle index.html
}));

// Cache index.html template in production
let cachedIndexHtml = '';
try {
  if (fs.existsSync(INDEX_PATH)) {
    cachedIndexHtml = fs.readFileSync(INDEX_PATH, 'utf8');
  } else {
    console.warn(`Warning: ${INDEX_PATH} not found. Make sure to run 'npm run build' first.`);
  }
} catch (err) {
  console.error('Error reading index.html:', err);
}

app.get('*', async (req, res) => {
  try {
    // If cache is empty (e.g. built during runtime), read it
    let html = cachedIndexHtml;
    if (!html) {
      if (fs.existsSync(INDEX_PATH)) {
        html = fs.readFileSync(INDEX_PATH, 'utf8');
      } else {
        return res.status(500).send('Index HTML not found. Please build frontend first.');
      }
    }

    const pagePath = normalizePagePath(req.path);
    const fullUrl = buildPublicUrl(req, pagePath);

    const seo = await getSeoByPath(pagePath, fullUrl);
    const finalHtml = injectSeoIntoHtml(html, seo);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.send(finalHtml);
  } catch (err) {
    console.error('Request processing failed:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`SEO Server is running on port ${PORT}`);
});
