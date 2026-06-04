/**
 * Tệp: CardioGuard AI – Logging Abstraction
 * Mục đích: Ẩn logs nhạy cảm và logs debug trên môi trường production,
 *           chỉ in ra console ở môi trường phát triển (DEV).
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
  warn: (...args: any[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Luôn log lỗi ra console để phục vụ giám sát và xử lý sự cố
    console.error(...args);
  }
};
