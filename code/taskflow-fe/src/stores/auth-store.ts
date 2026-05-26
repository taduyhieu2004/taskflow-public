import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '@/lib/query-client';
import type { User } from '@/types/auth';

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setSession: (session: AuthSession) => void;
  updateUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

/**
 * Xóa toàn bộ React Query cache. Gọi khi chuyển phiên (login / logout) để
 * tránh user mới thấy data của user cũ (projects, tasks, members …).
 */
function clearQueryCache() {
  queryClient.removeQueries();   // remove tất cả query
  queryClient.clear();           // clear mutation cache + state
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) => {
        // Nếu user khác user hiện tại (vd đổi account trong cùng tab),
        // wipe cache cũ trước khi set session mới.
        if (get().user?.id !== user.id) clearQueryCache();
        set({ accessToken, refreshToken, user });
      },
      updateUser: (user) => set({ user }),
      logout: () => {
        clearQueryCache();
        set({ accessToken: null, refreshToken: null, user: null });
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'taskflow.auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
