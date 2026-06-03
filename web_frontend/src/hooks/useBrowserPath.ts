/**
 * Tệp: CardioGuard AI – Hook đường dẫn trình duyệt và điều hướng
 * Mục đích: Cung cấp đường dẫn hiện tại có tính phản ứng và hàm navigate
 *           hoạt động với History API, cho phép định tuyến SPA mà không cần
 *           thư viện router.
 * Luồng xử lý: 1. Khởi tạo trạng thái từ window.location.pathname.
 *              2. Lắng nghe sự kiện popstate (back/forward).
 *              3. navigate() sử dụng pushState hoặc replaceState và cập nhật trạng thái.
 * Quan hệ:
 *   - Được sử dụng bởi: App.tsx, RoleLayout, ProtectedRoute để điều hướng mệnh lệnh
 */

import { useEffect, useState } from "react";

/**
 * Hook đường dẫn trình duyệt có tính phản ứng.
 * Trả về { path, navigate } trong đó navigate(đích, thay_thế) cập nhật URL
 * và kích hoạt re-render.
 */
export const useBrowserPath = () => {
  const [path, setPath] = useState(() => window.location.pathname || "/");

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (to: string, replace = false) => {
    if (window.location.pathname === to) {
      setPath(to);
      return;
    }

    if (replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }
    setPath(to);
  };

  return { path, navigate };
};
