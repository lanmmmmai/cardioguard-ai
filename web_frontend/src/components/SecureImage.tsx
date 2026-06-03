import React, { useEffect, useState } from 'react';

interface SecureImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  accessToken: string | null;
}

/**
 * Component SecureImage - tải hình ảnh bảo mật từ API Server y tế một cách an toàn.
 *
 * Thay vì truyền Access Token vào URL qua tham số truy vấn (URL query parameter) dễ bị lộ,
 * component này thực hiện gọi API fetch hình ảnh kèm header Authorization: Bearer <token>.
 * Dữ liệu trả về (binary blob) được chuyển thành một Object URL tạm thời để gán vào thẻ <img>,
 * và được thu hồi (revoke) khi component unmount.
 */
export const SecureImage: React.FC<SecureImageProps> = ({ src, accessToken, ...props }) => {
  const [objectUrl, setObjectUrl] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!src) {
      setObjectUrl('');
      setLoading(false);
      return;
    }

    // Nếu là URL tuyệt đối hoặc là data URI, có thể hiển thị trực tiếp
    if (src.startsWith('http') || src.startsWith('data:')) {
      setObjectUrl(src);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);

    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    fetch(src, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Không thể tải hình ảnh bảo mật');
        return res.blob();
      })
      .then((blob) => {
        if (isMounted) {
          const url = URL.createObjectURL(blob);
          setObjectUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[SecureImage] Error fetching image:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (objectUrl && !src.startsWith('http') && !src.startsWith('data:')) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, accessToken]);

  if (loading) {
    return (
      <div 
        className="secure-image-loader" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: props.style?.width || '100%', 
          height: props.style?.height || '100%', 
          minHeight: '100px',
          color: 'var(--text-secondary)',
          fontSize: '0.75rem'
        }}
      >
        Đang tải...
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="secure-image-error" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: props.style?.width || '100%', 
          height: props.style?.height || '100%', 
          minHeight: '100px', 
          color: 'var(--color-critical)',
          fontSize: '0.75rem',
          border: '1px dashed var(--glass-border)',
          borderRadius: '12px'
        }}
      >
        Lỗi tải ảnh
      </div>
    );
  }

  return <img src={objectUrl} {...props} />;
};
