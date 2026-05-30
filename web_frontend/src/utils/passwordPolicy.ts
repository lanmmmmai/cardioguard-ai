export const passwordPattern = /^(?=.*[A-Z])(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export const passwordPolicyMessage = 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa, chữ cái, số và ký tự đặc biệt.';

export const isStrongPassword = (value: string) => passwordPattern.test(value);
