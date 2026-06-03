const isJsonLike = (contentType: string | null, body: string) => {
  if (contentType?.includes('application/json') || contentType?.includes('+json')) return true;
  const trimmed = body.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
};

export const readJsonResponse = async <T = any>(response: Response): Promise<T> => {
  const body = await response.text();
  if (!body) return {} as T;

  const contentType = response.headers.get('content-type');
  if (!isJsonLike(contentType, body)) {
    throw new Error(`Máy chủ trả về phản hồi không hợp lệ (${response.status} ${response.statusText || 'Unknown'})`);
  }

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('Lỗi định dạng phản hồi từ server');
  }
};
