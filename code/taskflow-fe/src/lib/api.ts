import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorPayload, ApiResponse } from '@/types/api';
import { useAuthStore } from '@/stores/auth-store';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1';

export const apiBaseUrl = baseURL;

/**
 * Resolve avatar_url stored as MinIO key (e.g. "u3/abc.jpg") to a full URL the
 * browser can load directly. Full URLs (http/https) are returned unchanged so
 * older user records keep working.
 */
export function resolveAvatarUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseURL}/users/avatars/${value}`;
}

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setSession, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return null;
  }
  try {
    const res = await axios.post<ApiResponse<import('@/types/auth').LoginResponse>>(
      `${baseURL}/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    );
    const data = res.data.data;
    setSession({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: { id: data.id, username: data.username, email: '' },
    });
    return data.access_token;
  } catch {
    logout();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorPayload>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      refreshing = refreshing ?? refreshAccessToken();
      const token = await refreshing;
      refreshing = null;
      if (token && original.headers) {
        original.headers.Authorization = `Bearer ${token}`;
        return api.request(original);
      }
    }
    return Promise.reject(error);
  },
);

export function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError<ApiErrorPayload>(err)) {
    return err.response?.data?.message ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Đã có lỗi xảy ra';
}

export function unwrap<T>(res: { data: ApiResponse<T> }): T {
  return res.data.data;
}
