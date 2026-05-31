export const passwordPattern = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/;

export const passwordPolicyMessage = 'Mật khẩu cần từ 8 đến 72 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt.';

export const isStrongPassword = (value: string) => passwordPattern.test(value);
