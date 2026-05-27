import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { activitiesApi } from '@/features/activities/activities-api';
import { Avatar } from '@/components/ui/avatar';
import { formatRelativeTime } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
}

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

export function ProjectActivitiesDialog({ open, onOpenChange, projectId }: Props) {
  const { data: activities = [], isLoading, error } = useQuery({
    queryKey: ['activities', 'project', projectId],
    queryFn: () => activitiesApi.byProject(projectId),
    enabled: open && !!projectId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl sm:max-w-2xl bg-white border border-gray-100 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] p-6 gap-0">
        <DialogHeader className="pb-4 border-b border-gray-100 flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-50 text-primary-600">
              <Activity className="w-5 h-5" />
            </div>
            <span>Lịch sử hoạt động dự án</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1">
            Theo dõi tất cả các hoạt động, thay đổi của các thành viên trong dự án này.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-5 pr-1 scrollbar-thin space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-primary-100 border-t-primary-600 animate-spin" />
              <p className="text-sm text-gray-400 font-medium">Đang tải lịch sử hoạt động…</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4 rounded-xl bg-rose-50/50 border border-rose-100 text-rose-600 text-sm">
              Đã xảy ra lỗi khi tải lịch sử hoạt động. Vui lòng thử lại sau.
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-gray-50 text-gray-400 mb-3">
                <Activity className="w-8 h-8" />
              </div>
              <p className="text-sm text-gray-500 font-semibold">Chưa có hoạt động nào</p>
              <p className="text-xs text-gray-400 max-w-xs mt-1">Các sự kiện và hoạt động của dự án sẽ được tự động ghi nhận lại tại đây.</p>
            </div>
          ) : (
            <div className="relative border-l border-gray-100 pl-6 ml-3 space-y-6">
              {activities.map((a) => {
                const display =
                  a.message ??
                  `${a.actor_name ?? `Người dùng #${a.actor_id}`} ${
                    FALLBACK_LABEL[a.action] ?? a.action
                  }`;
                const seed = a.actor_id;
                const name = a.actor_name ?? `U${a.actor_id}`;

                return (
                  <div key={a.id} className="relative group transition-all duration-200">
                    {/* Activity timeline dot */}
                    <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-primary-200 ring-4 ring-white group-hover:bg-primary-500 group-hover:scale-110 transition-all duration-200" />
                    
                    <div className="flex gap-4 items-start bg-gray-50/30 hover:bg-gray-50/80 p-3 rounded-xl border border-transparent hover:border-gray-100/50 transition-all duration-200">
                      <Avatar seed={seed} name={name} size="sm" ringClass="ring-1 ring-gray-100" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">
                          {display}
                        </p>
                        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1.5">
                          <span>{formatRelativeTime(a.occurred_at)}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-gray-100 flex-shrink-0 flex items-center justify-end">
          <DialogClose asChild>
            <Button variant="secondary" size="sm" className="rounded-lg px-4 font-semibold hover:bg-gray-100 transition">
              Đóng
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
