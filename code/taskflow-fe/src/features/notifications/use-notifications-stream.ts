import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { stompClient } from '@/lib/ws';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore, type ToastVariant } from '@/stores/toast-store';
import type { Notification } from '@/types/notification';

function variantFor(type?: string | null): ToastVariant {
  switch (type) {
    case 'TASK_OVERDUE':
    case 'TASK_DELETED':
      return 'error';
    case 'TASK_DUE_SOON':
      return 'warning';
    case 'TASK_ASSIGNED':
    case 'MEMBER_INVITED':
      return 'success';
    default:
      return 'info';
  }
}

export function useNotificationsStream() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) {
      stompClient.disconnect();
      return;
    }

    let unsub: (() => void) | undefined;

    stompClient.connect({
      token: accessToken,
      onConnect: () => {
        unsub = stompClient.subscribe<Notification>('/user/queue/notifications', (notif) => {
          queryClient.setQueryData<{ count: number } | undefined>(
            ['notifications', 'unread'],
            (old) => ({ count: (old?.count ?? 0) + 1 }),
          );
          queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });

          // Toast nổi góc phải, click để điều hướng đến link
          useToastStore.getState().push({
            title: notif.title,
            body: notif.body ?? undefined,
            href: notif.link ?? undefined,
            variant: variantFor(notif.type),
          });

          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            window.Notification.permission === 'granted'
          ) {
            new window.Notification(notif.title, { body: notif.body ?? undefined });
          }
        });
      },
    });

    return () => {
      unsub?.();
      stompClient.disconnect();
    };
  }, [accessToken, queryClient]);
}
