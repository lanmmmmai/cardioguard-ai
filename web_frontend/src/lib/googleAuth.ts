import { API_URL } from '../config';
import { readJsonResponse } from '../utils/response';

export interface GoogleAuthUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status?: string;
  must_change_password?: boolean;
  profile_completed?: boolean;
  is_verified?: boolean;
}

export interface GoogleAuthResponse {
  detail?: string;
  access_token?: string;
  user?: GoogleAuthUser;
}

export interface GoogleAuthSuccessResponse {
  access_token: string;
  user: GoogleAuthUser;
}

export const exchangeGoogleIdToken = async (idToken: string, role: string): Promise<GoogleAuthSuccessResponse> => {
  const response = await fetch(`${API_URL}/auth/google-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id_token: idToken, role }),
  });

  const data = await readJsonResponse<GoogleAuthResponse>(response);

  if (!response.ok) {
    throw new Error(data.detail || 'Đăng nhập Google thất bại');
  }

  if (!data.access_token || !data.user) {
    throw new Error('Phản hồi đăng nhập Google không đầy đủ từ server');
  }

  return {
    access_token: data.access_token,
    user: data.user,
  };
};
