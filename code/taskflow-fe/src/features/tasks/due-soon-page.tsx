import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, ChevronRight, Clock, ExternalLink, Flag, Hourglass } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { projectsApi } from '@/features/projects/projects-api';
import { tasksApi } from '@/features/tasks/tasks-api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { Priority, Task } from '@/types/task';

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

export function DueSoonPage() {
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

  const sortedTasks = useMemo(() => {
    const tasks = tasksData?.content ?? [];
    return tasks
      .filter((t) => t.due_date != null)
      .slice()
      .sort((a, b) => a.due_date! - b.due_date!);
  }, [tasksData]);

  // Categorize tasks
  const categories = useMemo(() => {
    const now = Date.now();
    const twoDaysFromNow = now + 48 * 60 * 60 * 1000;

    const overdue: Task[] = [];
    const urgent: Task[] = []; // next 48h
    const upcoming: Task[] = [];

    sortedTasks.forEach((t) => {
      if (!t.due_date) return;
      if (t.due_date < now) {
        overdue.push(t);
      } else if (t.due_date <= twoDaysFromNow) {
        urgent.push(t);
      } else {
        upcoming.push(t);
      }
    });

    return { overdue, urgent, upcoming };
  }, [sortedTasks]);

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/dashboard" className="hover:text-gray-700">Dashboard</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Sắp hết hạn</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
          <Clock className="w-6 h-6 text-rose-500" /> Sắp hết hạn
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Theo dõi các công việc sắp đến hạn hoàn thành để quản lý thời gian hiệu quả.
        </p>
      </div>

      {/* Categories Grid */}
      {tasksLoading ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center text-sm text-gray-400">
          Đang tải thông tin thời hạn…
        </div>
      ) : sortedTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-16 text-center">
          <Clock className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-gray-900">Không có công việc nào sắp hết hạn</h3>
          <p className="text-xs text-gray-500 mt-1">Tuyệt vời! Bạn không có task nào bị trễ hoặc sắp đến hạn.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overdue Section */}
          {categories.overdue.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Trễ hạn ({categories.overdue.length})
              </h2>
              <div className="bg-rose-50/20 rounded-2xl border border-rose-200/50 shadow-sm overflow-hidden divide-y divide-rose-100">
                {categories.overdue.map((t) => (
                  <TaskRow key={t.id} task={t} projectMap={projectMap} isOverdue />
                ))}
              </div>
            </div>
          )}

          {/* Near Due (Next 48 hours) */}
          {categories.urgent.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                <Hourglass className="w-4 h-4" /> Đến hạn trong 48h ({categories.urgent.length})
              </h2>
              <div className="bg-amber-50/20 rounded-2xl border border-amber-200/50 shadow-sm overflow-hidden divide-y divide-amber-100">
                {categories.urgent.map((t) => (
                  <TaskRow key={t.id} task={t} projectMap={projectMap} isNearDue />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Section */}
          {categories.upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Sắp tới ({categories.upcoming.length})
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                {categories.upcoming.map((t) => (
                  <TaskRow key={t.id} task={t} projectMap={projectMap} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  projectMap: Map<number, import('@/types/project').Project>;
  isOverdue?: boolean;
  isNearDue?: boolean;
}

function TaskRow({ task, projectMap, isOverdue, isNearDue }: TaskRowProps) {
  const project = projectMap.get(task.project_id);

  return (
    <div
      className={cn(
        'p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition hover:bg-gray-50/50',
        isOverdue && 'bg-rose-50/10',
        isNearDue && 'bg-amber-50/10',
      )}
    >
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
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span
            className={cn(
              'flex items-center gap-1.5 font-semibold',
              isOverdue && 'text-rose-600',
              isNearDue && 'text-amber-600',
              !isOverdue && !isNearDue && 'text-gray-500',
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            Hạn: {new Date(task.due_date!).toLocaleDateString('vi-VN')}
            {isOverdue && ' (Quá hạn)'}
            {isNearDue && ' (Gấp)'}
          </span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">Tạo: {new Date(task.created_at).toLocaleDateString('vi-VN')}</span>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <Link
          to={`/projects/${task.project_id}`}
          className="px-4 py-2 text-xs font-semibold text-primary-600 hover:bg-primary-50 rounded-xl border border-primary-100 flex items-center gap-1.5 transition bg-white"
        >
          Xem bảng <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
