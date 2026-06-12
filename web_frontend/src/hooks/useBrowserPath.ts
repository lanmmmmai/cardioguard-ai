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

const PATH_CHANGE_EVENT = "cardioguard:pathchange";

/**
 * Read the current browser path used by the SPA router.
 *
 * @returns Current pathname, falling back to root when unavailable
 */
const readCurrentPath = () => window.location.pathname || "/";

/**
 * Hook đường dẫn trình duyệt có tính phản ứng.
 * Trả về { path, navigate } trong đó navigate(đích, thay_thế) cập nhật URL
 * và kích hoạt re-render.
 */
export const useBrowserPath = () => {
  const [path, setPath] = useState(readCurrentPath);

  useEffect(() => {
    const syncPath = () => setPath(readCurrentPath());
    window.addEventListener("popstate", syncPath);
    window.addEventListener(PATH_CHANGE_EVENT, syncPath);
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener(PATH_CHANGE_EVENT, syncPath);
    };
  }, []);

  const navigate = (to: string, replace = false) => {
    if (window.location.pathname === to) {
      setPath(to);
      window.dispatchEvent(new Event(PATH_CHANGE_EVENT));
      return;
    }

    if (replace) {
      window.history.replaceState(null, "", to);
    } else {
      window.history.pushState(null, "", to);
    }
    setPath(to);
    window.dispatchEvent(new Event(PATH_CHANGE_EVENT));
  };

  return { path, navigate };
};
