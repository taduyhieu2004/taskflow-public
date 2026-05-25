import { Bell, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore, type Toast, type ToastVariant } from '@/stores/toast-store';
import { cn } from '@/lib/utils';

const VARIANT_META: Record<
  ToastVariant,
  { icon: React.ReactNode; ring: string; iconBg: string }
> = {
  info: {
    icon: <Bell className="w-4 h-4" />,
    ring: 'border-primary-200',
    iconBg: 'bg-primary-50 text-primary-600',
  },
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    ring: 'border-emerald-200',
    iconBg: 'bg-emerald-50 text-emerald-600',
  },
  warning: {
    icon: <TriangleAlert className="w-4 h-4" />,
    ring: 'border-amber-200',
    iconBg: 'bg-amber-50 text-amber-600',
  },
  error: {
    icon: <Info className="w-4 h-4" />,
    ring: 'border-rose-200',
    iconBg: 'bg-rose-50 text-rose-600',
  },
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const navigate = useNavigate();
  const meta = VARIANT_META[toast.variant ?? 'info'];

  useEffect(() => {
    if (!toast.durationMs) return;
    const timer = window.setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  function handleClick() {
    toast.onClick?.();
    if (toast.href) navigate(toast.href);
    dismiss(toast.id);
  }

  const clickable = !!(toast.href || toast.onClick);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto bg-white rounded-xl border shadow-lg p-3 flex items-start gap-3 animate-slide-in-right',
        meta.ring,
        clickable && 'cursor-pointer hover:shadow-xl transition',
      )}
      onClick={clickable ? handleClick : undefined}
    >
      <div
        className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          meta.iconBg,
        )}
      >
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{toast.title}</div>
        {toast.body && (
          <div className="text-xs text-gray-600 mt-0.5 line-clamp-2">{toast.body}</div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          dismiss(toast.id);
        }}
        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition flex-shrink-0"
        aria-label="Đóng"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
