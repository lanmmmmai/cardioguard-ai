// CardioGuard AI — tạo Supabase client với kiểm tra env an toàn.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Xác thực biến môi trường Supabase và chặn placeholder credentials trong môi trường dev.
 */
const resolveSupabaseConfig = (): { url: string; anonKey: string } => {
  if (!supabaseUrl || !supabaseAnonKey) {
    const message = 'Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong web_frontend/.env.local';
    if (import.meta.env.DEV) {
      throw new Error(message);
    }
    throw new Error('Supabase chưa được cấu hình cho môi trường hiện tại');
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
};

const { url, anonKey } = resolveSupabaseConfig();

export const supabase = createClient(
  url,
  anonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

export const createSupabaseClient = (accessToken?: string | null): SupabaseClient => {
  if (!accessToken) return supabase;

  return createClient(
    url,
    anonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
};
