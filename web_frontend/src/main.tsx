/**
 * Tệp: CardioGuard AI – Khởi tạo ứng dụng
 * Mục đích: Gắn thành phần React gốc (<App />) vào DOM bên trong
 *           StrictMode để React chạy các kiểm tra dành riêng cho môi trường phát triển.
 * Luồng xử lý: 1. Truy vấn phần tử <div id="root"> từ index.html.
 *              2. Tạo một React root thông qua createRoot.
 *              3. Render <App /> được bọc trong <React.StrictMode>.
 * Quan hệ:
 *   - index.html      cung cấp điểm gắn (#root)
 *   - ./App           thành phần cấp cao nhất sở hữu routing và các provider
 *   - ./index.css     stylesheet toàn cục (import để có tác dụng phụ)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
