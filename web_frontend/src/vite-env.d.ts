/**
 * @file Bổ sung kiểu dữ liệu Vite phía máy khách cho CardioGuard AI
 * @mục_đích  Cung cấp định kiểu TypeScript cho các import đặc thù của Vite như
 *           import.meta.env và các mô-đun nội dung (*.svg, *.css, v.v.).
 * @luồng_xử_lý Chỉ thị ba dấu gạch chéo kéo các khai báo kiểu đi kèm của Vite
 *           để IDE hiểu các biến toàn cục đặc thù của Vite.
 * @mối_quan_hệ
 *   - Được tham chiếu bởi mọi tệp TS/TSX sử dụng import.meta.env.
 */

/// <reference types="vite/client" />
