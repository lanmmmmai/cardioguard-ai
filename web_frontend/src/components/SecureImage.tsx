// CardioGuard AI — tải media riêng tư qua Authorization header an toàn.
import React, { useEffect, useState, useRef } from 'react';

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
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!src) {
      setObjectUrl('');
      setError(false);
      setLoading(false);
      return () => undefined;
    }

    if (src.startsWith('data:')) {
      setObjectUrl(src);
      setError(false);
      setLoading(false);
      return () => undefined;
    }

    setLoading(true);
    setError(false);

    const shouldUseAuthenticatedFetch = Boolean(accessToken);
    const headers: HeadersInit = {};
    if (shouldUseAuthenticatedFetch && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const loadImage = shouldUseAuthenticatedFetch
      ? fetch(src, { headers })
      : Promise.resolve(new Response(null, { status: 204 }));

    loadImage
      .then((res) => {
        if (!shouldUseAuthenticatedFetch) {
          if (isMounted) {
            setObjectUrl(src);
            setLoading(false);
          }
          return null;
        }
        if (!res.ok) throw new Error('Không thể tải hình ảnh bảo mật');
        return res.blob();
      })
      .then((blob) => {
        if (!blob) {
          return;
        }
        if (isMounted) {
          // Thu hồi URL cũ trước khi gán URL mới
          if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
          }
          const generatedObjectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = generatedObjectUrl;
          setObjectUrl(generatedObjectUrl);
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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
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
