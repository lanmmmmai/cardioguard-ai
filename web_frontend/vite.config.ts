/**
 * @file Cấu hình xây dựng Vite cho CardioGuard AI
 * @mục_đích  Định nghĩa máy chủ phát triển, phân chia bản dựng và thiết lập plugin
 *           cho giao diện React SPA.
 * @luồng_xử_lý Vite phục vụ ứng dụng trên cổng 5173 (host: true cho truy cập LAN).
 *          Bản dựng sản xuất tách node_modules thành một chunk vendor riêng
 *          và nâng giới hạn cảnh báo kích thước chunk lên 1000 kB.
 * @mối_quan_hệ
 *   - Cung cấp môi trường xây dựng/phát triển cho tất cả tệp /web_frontend/src.
 *   - @vitejs/plugin-react kích hoạt biên dịch JSX và Fast Refresh.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) {
              return 'react-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'ui-vendor';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});
