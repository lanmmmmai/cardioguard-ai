import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

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

// Configure Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://uoquxbpeimkyppqfpgmo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_CfXFtdXtL9eiiebohBpVyA_T_Pa2jVm';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: false
  },
  global: {
    headers: {
      'x-client-info': 'cardioguard-seo-server'
    }
  },
  realtime: {
    transport: ws
  }
});

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

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

async function getSeoByPath(pagePath, fullUrl) {
  try {
    const { data, error } = await supabase
      .from('domain_links')
      .select('title, description, image_url')
      .eq('url', fullUrl)
      .single();

    if (error || !data) {
      // Fallback
      return {
        title: 'CardioGuard AI - Giám sát sức khỏe tim mạch thời gian thực',
        description: 'CardioGuard AI - Hệ thống giám sát sức khỏe tim mạch thời gian thực. Theo dõi nhịp tim, SpO2, huyết áp và điện tâm đồ thông qua các cảm biến IoT đeo thông minh.',
        image: 'https://giatky.site/images/preview.jpg'
      };
    }

    return {
      title: data.title,
      description: data.description,
      image: data.image_url
    };
  } catch (err) {
    console.error('Supabase query failed:', err);
    return {
      title: 'CardioGuard AI - Giám sát sức khỏe tim mạch thời gian thực',
      description: 'CardioGuard AI - Hệ thống giám sát sức khỏe tim mạch thời gian thực. Theo dõi nhịp tim, SpO2, huyết áp và điện tâm đồ thông qua các cảm biến IoT đeo thông minh.',
      image: 'https://giatky.site/images/preview.jpg'
    };
  }
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

    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers.host || req.get('host') || 'giatky.site';
    
    // Normalize path to ignore trailing slashes (except root)
    let pagePath = req.path;
    if (pagePath.length > 1 && pagePath.endsWith('/')) {
      pagePath = pagePath.slice(0, -1);
    }

    let fullUrl = `${proto}://${host}${pagePath}`;
    
    // Fallback host mapping for local testing
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      fullUrl = `https://giatky.site${pagePath}`;
    }

    const seo = await getSeoByPath(pagePath, fullUrl);

    // Escape dynamic parameters
    const finalHtml = html
      .replaceAll('__SEO_TITLE__', escapeHtml(seo.title))
      .replaceAll('__SEO_DESCRIPTION__', escapeHtml(seo.description))
      .replaceAll('__SEO_IMAGE__', escapeHtml(seo.image))
      .replaceAll('__SEO_URL__', escapeHtml(fullUrl));

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(finalHtml);
  } catch (err) {
    console.error('Request processing failed:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.log(`SEO Server is running on port ${PORT}`);
});
