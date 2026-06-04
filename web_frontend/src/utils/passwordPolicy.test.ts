import { describe, expect, it } from 'vitest';
import { getPasswordPolicyMessage, isStrongPassword } from './passwordPolicy';

describe('passwordPolicy', () => {
  describe('isStrongPassword', () => {
    it('chấp nhận mật khẩu mạnh hợp lệ', () => {
      expect(isStrongPassword('StrongPassword123!')).toBe(true);
      expect(isStrongPassword('Aa1!a1a1')).toBe(true);
      expect(isStrongPassword('Admin@123')).toBe(true);
    });

    it('từ chối mật khẩu quá ngắn (< 8 ký tự)', () => {
      expect(isStrongPassword('Aa1!a1a')).toBe(false);
    });

    it('từ chối mật khẩu thiếu chữ hoa', () => {
      expect(isStrongPassword('strongpassword123!')).toBe(false);
    });

    it('từ chối mật khẩu thiếu chữ thường', () => {
      expect(isStrongPassword('STRONGPASSWORD123!')).toBe(false);
    });

    it('từ chối mật khẩu thiếu chữ số', () => {
      expect(isStrongPassword('StrongPassword!')).toBe(false);
    });

    it('từ chối mật khẩu thiếu ký tự đặc biệt', () => {
      expect(isStrongPassword('StrongPassword123')).toBe(false);
    });
  });

  describe('getPasswordPolicyMessage', () => {
    it('trả về thông báo tiếng Anh khi locale là en', () => {
      const msg = getPasswordPolicyMessage('en');
      expect(msg).toContain('Password must be 8 to 72 characters');
    });

    it('trả về thông báo tiếng Việt khi locale là vi', () => {
      const msg = getPasswordPolicyMessage('vi');
      expect(msg).toContain('Mật khẩu cần từ 8 đến 72 ký tự');
    });
  });
});
