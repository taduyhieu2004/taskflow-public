import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, ChevronRight, ClipboardList, ExternalLink, Flag, UserCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/features/projects/projects-api';
import { tasksApi } from '@/features/tasks/tasks-api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { Priority } from '@/types/task';

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: 'bg-slate-50 text-slate-700 border-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-200',
  URGENT: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PRIORITY_ICON_COLOR: Record<Priority, string> = {
  LOW: 'text-slate-400',
  MEDIUM: 'text-blue-500',
  HIGH: 'text-amber-500',
  URGENT: 'text-rose-500',
};

export function MyTasksPage() {
  const me = useAuthStore((s) => s.user);

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['my-tasks', me?.id],
    queryFn: () => tasksApi.list({ assignee_id: me?.id!, size: 200 }),
    enabled: !!me?.id,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const projectMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p]));
  }, [projects]);

  const tasks = tasksData?.content ?? [];

  // Metrics
  const metrics = useMemo(() => {
    const now = Date.now();
    let overdue = 0;
    let highPriority = 0;

    tasks.forEach((t) => {
      if (t.due_date && t.due_date < now) overdue++;
      if (t.priority === 'HIGH' || t.priority === 'URGENT') highPriority++;
    });

    return { total: tasks.length, overdue, highPriority };
  }, [tasks]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Task của tôi</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <UserCheck className="w-6 h-6 text-primary-600" /> Task của tôi
        </h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý và theo dõi tất cả các công việc được giao cho bạn.</p>
      </div>

      {/* Metrics Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary-50 rounded-xl">
            <ClipboardList className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{metrics.total}</div>
            <div className="text-xs text-gray-500">Tổng công việc</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 rounded-xl">
            <AlertCircle className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-600">{metrics.overdue}</div>
            <div className="text-xs text-gray-500">Đã trễ hạn</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl">
            <Flag className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{metrics.highPriority}</div>
            <div className="text-xs text-gray-500">Ưu tiên cao</div>
          </div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {tasksLoading ? (
          <div className="p-12 text-center text-sm text-gray-400">Đang tải danh sách công việc…</div>
        ) : tasks.length === 0 ? (
          <div className="p-16 text-center">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-gray-900">Không có công việc nào</h3>
            <p className="text-xs text-gray-500 mt-1">Tuyệt vời! Bạn không có task nào đang chờ thực hiện.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {tasks.map((task) => {
              const project = projectMap.get(task.project_id);
              const isOverdue = task.due_date && task.due_date < Date.now();

              return (
                <div key={task.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold rounded-md tracking-wide uppercase">
                        {project?.name ?? `Project #${task.project_id}`}
                      </span>
                      {task.priority && (
                        <span className={cn('px-2 py-0.5 text-[10px] font-semibold border rounded-md flex items-center gap-1', PRIORITY_BADGE[task.priority])}>
                          <Flag className={cn('w-3 h-3', PRIORITY_ICON_COLOR[task.priority])} />
                          {task.priority}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                      {task.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      {task.due_date && (
                        <span className={cn('flex items-center gap-1.5 font-medium', isOverdue ? 'text-rose-600' : 'text-gray-500')}>
                          <Calendar className="w-3.5 h-3.5" />
                          Hạn: {new Date(task.due_date).toLocaleDateString('vi-VN')}
                          {isOverdue && ' (Trễ)'}
                        </span>
                      )}
                      <span>·</span>
                      <span>Tạo ngày: {new Date(task.created_at).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      to={`/projects/${task.project_id}`}
                      className="px-4 py-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 rounded-xl border border-primary-100 flex items-center gap-1.5 transition"
                    >
                      Xem bảng <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
