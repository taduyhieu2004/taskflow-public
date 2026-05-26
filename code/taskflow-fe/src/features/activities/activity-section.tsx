import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { activitiesApi } from '@/features/activities/activities-api';
import { Avatar } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';

interface Props {
  taskId: number;
}

/**
 * Fallback hiển thị nếu BE chưa trả `message` (data cũ trước khi nâng cấp renderer).
 * Mapping theo event_type mới (lowercase, dùng dấu chấm).
 */
const FALLBACK_LABEL: Record<string, string> = {
  'task.created':            'đã tạo công việc',
  'task.updated':            'đã cập nhật công việc',
  'task.moved':              'đã chuyển công việc',
  'task.deleted':            'đã xóa công việc',
  'task.assigned':           'đã giao công việc',
  'task.dependency.changed': 'đã cập nhật quan hệ phụ thuộc',
  'comment.added':           'đã bình luận',
  'attachment.uploaded':     'đã đính kèm tệp',
  'project.created':         'đã tạo dự án',
  'project.member.added':    'đã thêm thành viên',
  'project.member.removed':  'đã xóa thành viên',
  'board.created':           'đã tạo bảng Kanban',
  'list.created':            'đã tạo cột',
};

export function ActivitySection({ taskId }: Props) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', 'task', taskId],
    queryFn: () => activitiesApi.byTask(taskId),
  });

  return (
    <div className="p-5 bg-gray-50 min-h-full">
      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4" /> Lịch sử hoạt động
      </h3>

      {isLoading ? (
        <p className="text-xs text-gray-400">Đang tải…</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Chưa có hoạt động nào.</p>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => {
            // Ưu tiên dùng `message` đã render từ BE; fallback ghép thủ công nếu thiếu
            const display =
              a.message ??
              `${a.actor_name ?? `Người dùng #${a.actor_id}`} ${
                FALLBACK_LABEL[a.action] ?? a.action
              }`;
            const seed = a.actor_id;
            const name = a.actor_name ?? `U${a.actor_id}`;
            return (
              <div key={a.id} className="flex gap-3 items-start">
                <Avatar seed={seed} name={name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 leading-relaxed">{display}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatRelativeTime(a.occurred_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
