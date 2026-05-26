import { useNavigate } from 'react-router-dom';
import { authApi } from '@/features/auth/auth-api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Hook đăng xuất chuẩn:
 * 1. Gọi BE /auth/logout (best effort — revoke refresh token trong Redis).
 * 2. Clear auth store + React Query cache (qua auth-store.logout()).
 * 3. Điều hướng về /login.
 */
export function useLogout() {
  const logoutLocal = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return async () => {
    try {
      await authApi.logout();
    } catch {
      // BE có thể đã hết hạn token / down — không chặn flow logout local
    }
    logoutLocal();
    navigate('/login', { replace: true });
  };
}
