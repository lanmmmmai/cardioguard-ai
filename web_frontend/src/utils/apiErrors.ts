export const getRequestErrorMessage = (error: unknown, fallback: string, locale: 'vi' | 'en' = 'vi') => {
  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return locale === 'en'
      ? 'Cannot connect to server. Please try again later.'
      : 'Không kết nối được máy chủ. Vui lòng thử lại sau.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
};
