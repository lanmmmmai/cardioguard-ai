import { describe, expect, it } from 'vitest';
import { buildApiUrl, API_URL } from './config';

describe('config', () => {
  describe('buildApiUrl', () => {
    it('trả về trực tiếp nếu đường dẫn là URL tuyệt đối', () => {
      expect(buildApiUrl('http://example.com/api/test')).toBe('http://example.com/api/test');
      expect(buildApiUrl('https://example.com/api/test')).toBe('https://example.com/api/test');
    });

    it('nối đường dẫn tương đối với API_URL chính xác', () => {
      // Giả sử API_URL kết thúc bằng "/api"
      const base = API_URL.replace(/\/$/, '');
      expect(buildApiUrl('/patients')).toBe(`${base}/patients`);
      expect(buildApiUrl('patients')).toBe(`${base}/patients`);
    });

    it('tránh lỗi double /api path khi path bắt đầu bằng /api/', () => {
      const base = API_URL.replace(/\/$/, '');
      if (base.endsWith('/api')) {
        expect(buildApiUrl('/api/patients')).toBe(`${base}/patients`);
      }
    });

    it('trả về API_URL gốc nếu path là /api hoặc rỗng', () => {
      const base = API_URL.replace(/\/$/, '');
      expect(buildApiUrl('/api')).toBe(base);
    });
  });
});
