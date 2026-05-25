import { Bell, Calendar, FileText, Folder, MessageCircle, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  type: string;
  className?: string;
}

const TYPE_ICON: Record<string, { icon: React.ReactNode; bg: string }> = {
  TASK_ASSIGNED: { icon: <UserCheck className="w-4 h-4" />, bg: 'bg-blue-100 text-blue-600' },
  TASK_MENTIONED: { icon: <MessageCircle className="w-4 h-4" />, bg: 'bg-amber-100 text-amber-600' },
  TASK_DUE_SOON: { icon: <Calendar className="w-4 h-4" />, bg: 'bg-rose-100 text-rose-600' },
  COMMENT_CREATED: { icon: <MessageCircle className="w-4 h-4" />, bg: 'bg-emerald-100 text-emerald-600' },
  COMMENT_MENTION: { icon: <MessageCircle className="w-4 h-4" />, bg: 'bg-amber-100 text-amber-600' },
  ATTACHMENT_UPLOADED: { icon: <FileText className="w-4 h-4" />, bg: 'bg-violet-100 text-violet-600' },
  PROJECT_INVITED: { icon: <UserPlus className="w-4 h-4" />, bg: 'bg-amber-100 text-amber-600' },
  PROJECT_REMOVED: { icon: <Folder className="w-4 h-4" />, bg: 'bg-rose-100 text-rose-600' },
  TASK_DELETED: { icon: <Trash2 className="w-4 h-4" />, bg: 'bg-rose-100 text-rose-600' },
};

export function NotificationIcon({ type, className }: Props) {
  const cfg = TYPE_ICON[type] ?? { icon: <Bell className="w-4 h-4" />, bg: 'bg-gray-100 text-gray-600' };
  return <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg, className)}>{cfg.icon}</div>;
}
