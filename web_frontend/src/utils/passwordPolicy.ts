/**
 * Tệp: CardioGuard AI – Xác thực chính sách mật khẩu
 * Mục đích: Thực thi quy tắc mật khẩu mạnh: 8–72 ký tự, có ít nhất một
 *           chữ hoa, một chữ thường, một chữ số và một ký tự đặc biệt.
 * Luồng xử lý: isStrongPassword() kiểm tra giá trị với một RegExp duy nhất.
 *          passwordPattern được xuất để tái sử dụng trong các trình xác thực biểu mẫu.
 * Quan hệ:
 *   - Được sử dụng bởi: biểu mẫu đổi mật khẩu / đăng ký
 */

/** RegExp: 8–72 ký tự, ≥1 chữ hoa, ≥1 chữ thường, ≥1 chữ số, ≥1 ký tự đặc biệt */
export const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

/** Thông báo chính sách thân thiện với người dùng bằng tiếng Việt */
export const passwordPolicyMessage = 'Mật khẩu cần từ 8 đến 72 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.';

/** Lấy thông báo chính sách mật khẩu theo ngôn ngữ */
export const getPasswordPolicyMessage = (locale: 'vi' | 'en') => {
  return locale === 'en'
    ? 'Password must be 8 to 72 characters, including at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.'
    : 'Mật khẩu cần từ 8 đến 72 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.';
};

/** Kiểm tra xem mật khẩu có đáp ứng chính sách mạnh hay không */
export const isStrongPassword = (value: string) => passwordPattern.test(value);
