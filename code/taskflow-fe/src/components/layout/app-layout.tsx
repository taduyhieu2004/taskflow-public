import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { ToastViewport } from '@/components/ui/toast';
import { authApi } from '@/features/auth/auth-api';
import { useNotificationsStream } from '@/features/notifications/use-notifications-stream';
import { useAuthStore } from '@/stores/auth-store';

export function AppLayout() {
  const { user, updateUser } = useAuthStore();
  useNotificationsStream();

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
    enabled: !user || !user.email,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (me) updateUser(me);
  }, [me, updateUser]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Topbar />
      <Sidebar />
      <main className="ml-60 pt-14 min-h-screen">
        <Outlet />
      </main>
      <ToastViewport />
    </div>
  );
}
