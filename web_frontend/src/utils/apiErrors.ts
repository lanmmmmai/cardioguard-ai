export const getRequestErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return 'Không kết nối được máy chủ. Vui lòng thử lại sau.';
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
};
