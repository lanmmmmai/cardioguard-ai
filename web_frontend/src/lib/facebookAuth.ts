/**
 * CardioGuard AI — Facebook Login helper
 *
 * Flow: load Facebook JS SDK → FB.login() → lấy access_token →
 *       gửi lên /auth/facebook-login backend → nhận JWT + user.
 *
 * Không lưu bất kỳ secret nào ở frontend; App Secret chỉ dùng ở backend.
 */

import { API_URL } from '../config';
import { readJsonResponse } from '../utils/response';

declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: FBAuthResponse) => void,
        options?: { scope: string }
      ) => void;
      getLoginStatus: (callback: (response: FBAuthResponse) => void) => void;
    };
    fbAsyncInit?: () => void;
  }
}

interface FBAuthResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse: {
    accessToken: string;
    expiresIn: number;
    signedRequest: string;
    userID: string;
  } | null;
}

let sdkLoadPromise: Promise<void> | null = null;

export const loadFacebookSDK = (appId: string): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Facebook SDK chỉ hoạt động trên trình duyệt'));
  }
  if (window.FB) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
      resolve();
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/vi_VN/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Không tải được Facebook SDK'));
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
};

export const loginWithFacebook = (appId: string): Promise<string> =>
  new Promise((resolve, reject) => {
    loadFacebookSDK(appId)
      .then(() => {
        window.FB.login(
          (response) => {
            if (response.status === 'connected' && response.authResponse?.accessToken) {
              resolve(response.authResponse.accessToken);
            } else if (response.status === 'not_authorized') {
              reject(new Error('Bạn đã hủy đăng nhập bằng Facebook.'));
            } else {
              reject(new Error('Bạn đã hủy đăng nhập bằng Facebook.'));
            }
          },
          { scope: 'email,public_profile' }
        );
      })
      .catch(reject);
  });

// ─── Shape của response từ backend ───────────────────────────────────────────

export interface FacebookAuthUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status?: string;
  must_change_password?: boolean;
  profile_completed?: boolean;
  is_verified?: boolean;
  avatar_url?: string;
}

export interface FacebookAuthSuccessResponse {
  access_token: string;
  user: FacebookAuthUser;
}

/**
 * Gửi Facebook access_token lên backend để xác minh và đổi lấy JWT nội bộ.
 *
 * @param accessToken  Token từ Facebook JS SDK
 * @param role         Vai trò người dùng đang đăng nhập ('patient' | 'doctor' | 'admin')
 */
export const exchangeFacebookToken = async (
  accessToken: string,
  role: string
): Promise<FacebookAuthSuccessResponse> => {
  const response = await fetch(`${API_URL}/auth/facebook-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, role }),
  });

  const data = await readJsonResponse<{ detail?: string; access_token?: string; user?: FacebookAuthUser }>(response);

  if (!response.ok) {
    throw new Error(data.detail || 'Đăng nhập Facebook thất bại');
  }

  if (!data.access_token || !data.user) {
    throw new Error('Phản hồi đăng nhập Facebook không đầy đủ từ server');
  }

  return { access_token: data.access_token, user: data.user };
};
