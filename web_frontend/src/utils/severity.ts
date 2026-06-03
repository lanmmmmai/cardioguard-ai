/**
 * Tệp: CardioGuard AI – Chuẩn hóa và siêu dữ liệu mức độ nghiêm trọng cảnh báo
 * Mục đích: Ánh xạ các chuỗi mức độ nghiêm trọng thô từ backend (critical, high,
 *           warning, medium, low, info, resolved) thành SeverityType đã chuẩn hóa
 *           và cung cấp siêu dữ liệu hiển thị tương ứng (nhãn, màu sắc, biểu tượng).
 * Luồng xử lý: normalizeAlertSeverity() thu gọn các cấp độ tương tự (warning/medium,
 *              low/info) thành các kiểu chuẩn. getSeverityMeta() trả về một
 *              đối tượng SeverityMeta với các biến màu và biểu tượng Lucide cho UI.
 * Quan hệ:
 *   - Được sử dụng bởi: thành phần danh sách/chi tiết cảnh báo, widget dashboard
 *   - Import biểu tượng lucide-react cho huy hiệu mức độ nghiêm trọng
 */

import { ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

/** Các cấp độ nghiêm trọng chuẩn được sử dụng trên toàn bộ UI */
export type SeverityType = 'critical' | 'high' | 'warning' | 'medium' | 'low' | 'info' | 'resolved';

/** Gói siêu dữ liệu để hiển thị huy hiệu / chỉ báo mức độ nghiêm trọng */
export interface SeverityMeta {
  key: SeverityType;
  label: string;
  colorVar: string;
  bgVar: string;
  borderVar: string;
  weight: string;
  icon: any;
}

/**
 * Chuẩn hóa chuỗi mức độ nghiêm trọng thô thành SeverityType chuẩn.
 * - warning, medium → 'warning'
 * - low, info       → 'low'
 * - resolved        → 'resolved'
 * - mọi thứ khác   → 'low' (dự phòng an toàn)
 */
export const normalizeAlertSeverity = (severity?: string | null): SeverityType => {
  const s = severity?.trim().toLowerCase() || 'info';
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'warning' || s === 'medium') return 'warning';
  if (s === 'low' || s === 'info') return 'low';
  if (s === 'resolved') return 'resolved';
  return 'low';
};

/**
 * Trả về SeverityMeta đầy đủ (nhãn, biến màu, biểu tượng) cho một chuỗi
 * mức độ nghiêm trọng nhất định. Dự phòng về siêu dữ liệu 'low' nếu không được công nhận.
 */
export const getSeverityMeta = (severity?: string | null): SeverityMeta => {
  const norm = normalizeAlertSeverity(severity);
  switch (norm) {
    case 'critical':
      return {
        key: 'critical',
        label: 'Nguy kịch',
        colorVar: 'var(--color-critical)',
        bgVar: 'rgba(239, 68, 68, 0.12)',
        borderVar: '1px solid rgba(239, 68, 68, 0.35)',
        weight: '800',
        icon: ShieldAlert,
      };
    case 'high':
      return {
        key: 'high',
        label: 'Nghiêm trọng',
        colorVar: 'var(--color-critical)',
        bgVar: 'rgba(239, 68, 68, 0.08)',
        borderVar: '1px solid rgba(239, 68, 68, 0.25)',
        weight: '700',
        icon: ShieldAlert,
      };
    case 'warning':
    case 'medium':
      return {
        key: 'warning',
        label: 'Cảnh báo',
        colorVar: 'var(--color-warning)',
        bgVar: 'rgba(245, 158, 11, 0.1)',
        borderVar: '1px solid rgba(245, 158, 11, 0.28)',
        weight: '600',
        icon: AlertTriangle,
      };
    case 'low':
    case 'info':
      return {
        key: 'low',
        label: 'Theo dõi',
        colorVar: 'var(--color-info)',
        bgVar: 'rgba(59, 130, 246, 0.1)',
        borderVar: '1px solid rgba(59, 130, 246, 0.22)',
        weight: '500',
        icon: Info,
      };
    case 'resolved':
      return {
        key: 'resolved',
        label: 'Đã xử lý',
        colorVar: 'var(--color-safe)',
        bgVar: 'rgba(16, 185, 129, 0.08)',
        borderVar: '1px solid rgba(16, 185, 129, 0.2)',
        weight: '500',
        icon: CheckCircle2,
      };
  }
};
