/**
 * Vercel Edge Serverless Function - API Proxy
 * 
 * Mục đích:
 *   Proxy các yêu cầu API từ tên miền Frontend Vercel tới Backend Render.
 *   Giải quyết vấn đề CORS và hỗ trợ cache các phản hồi GET tại Edge (60 giây).
 */

export default async function handler(req, res) {
  // Lấy đường dẫn API thực tế sau phần "/api/"
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = urlObj.pathname.replace(/^\/api\//, '') + urlObj.search;
  
  // URL của Backend Render
  const backendBaseUrl = (process.env.BACKEND_API_URL || 'https://cardioguard-backend.onrender.com').replace(/\/$/, '');
  const targetUrl = `${backendBaseUrl}/${path}`;

  // Sao chép headers, loại bỏ các header đặc thù của host/proxy
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      headers[key] = value;
    }
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers,
    };

    // Forward body nếu phương thức không phải GET/HEAD
    if (!['GET', 'HEAD'].includes(req.method) && req.body !== undefined) {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';
    
    // Copy headers phản hồi từ backend
    for (const [key, value] of response.headers.entries()) {
      if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }

    // Thiết lập cache 60s cho các yêu cầu GET thành công tại Edge
    if (req.method === 'GET' && response.ok) {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    }

    res.status(response.status);

    if (contentType.includes('application/json')) {
      const json = await response.json();
      res.json(json);
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('API proxy failed:', error);
    res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}
