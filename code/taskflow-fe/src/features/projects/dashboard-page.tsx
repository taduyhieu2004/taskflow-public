import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarClock,
  ClipboardList,
  Clock,
  Folder,
  Plus,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateProjectDialog } from '@/features/projects/create-project-dialog';
import { ProjectCard } from '@/features/projects/project-card';
import { projectsApi } from '@/features/projects/projects-api';
import { tasksApi } from '@/features/tasks/tasks-api';
import { useDoneListIds } from '@/lib/use-done-list-ids';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

const DUE_SOON_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [createOpen, setCreateOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  const myTasksQuery = useQuery({
    queryKey: ['my-tasks', user?.id],
    queryFn: () => tasksApi.list({ assignee_id: user!.id, size: 200 }),
    enabled: !!user?.id,
  });

  const projects = projectsQuery.data ?? [];
  const myTasks = myTasksQuery.data?.content ?? [];
  const doneListIds = useDoneListIds(myTasks.map((t) => t.board_id));

  const stats = useMemo(() => {
    const now = Date.now();
    const active = myTasks.filter((t) => !doneListIds.has(t.list_id));
    const overdue = active.filter((t) => t.due_date != null && t.due_date < now).length;
    const dueSoon = active.filter(
      (t) => t.due_date != null && t.due_date >= now && t.due_date - now <= DUE_SOON_WINDOW_MS,
    ).length;
    return { overdue, dueSoon, activeCount: active.length };
  }, [myTasks, doneListIds]);

  const recentProjects = projects.slice(0, 3);

  return (
    <div className="p-8">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <div className="text-sm text-gray-500">Xin chào,</div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {user?.full_name ?? user?.username} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Tổng quan công việc và project của bạn hôm nay.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="px-3 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Tạo project mới
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard
          label="Tổng project"
          value={projects.length}
          icon={<Folder className="w-5 h-5" />}
          color="primary"
          to="/projects"
        />
        <StatCard
          label="Task được giao"
          value={myTasks.length}
          icon={<UserCheck className="w-5 h-5" />}
          color="amber"
          to="/my-tasks"
        />
        <StatCard
          label="Sắp đến hạn (3 ngày)"
          value={stats.dueSoon}
          icon={<CalendarClock className="w-5 h-5" />}
          color="orange"
          to="/due-soon"
        />
        <StatCard
          label="Quá hạn"
          value={stats.overdue}
          icon={<AlertCircle className="w-5 h-5" />}
          color="rose"
          to="/due-soon"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-10">
        <div className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-900">Project gần đây</h2>
            <Link
              to="/projects"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
            >
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {projectsQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-gray-200" />
                  <div className="h-5 bg-gray-200 rounded w-3/4 mt-3" />
                  <div className="h-4 bg-gray-100 rounded w-full mt-2" />
                </div>
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 text-center">
              <Folder className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Bạn chưa có project nào.</p>
              <button
                onClick={() => setCreateOpen(true)}
                className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tạo project đầu tiên
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recentProjects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Lối tắt</h2>
          <div className="space-y-2">
            <QuickLink to="/my-tasks" icon={<ClipboardList className="w-4 h-4" />}>
              Task của tôi
              <span className="ml-auto text-xs text-gray-400">{myTasks.length}</span>
            </QuickLink>
            <QuickLink to="/due-soon" icon={<Clock className="w-4 h-4" />}>
              Sắp đến hạn
              <span className="ml-auto text-xs text-gray-400">{stats.dueSoon}</span>
            </QuickLink>
            <QuickLink to="/notifications" icon={<Bell className="w-4 h-4" />}>
              Thông báo
            </QuickLink>
            <QuickLink to="/projects" icon={<Folder className="w-4 h-4" />}>
              Tất cả project
              <span className="ml-auto text-xs text-gray-400">{projects.length}</span>
            </QuickLink>
          </div>
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  to,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'amber' | 'orange' | 'rose';
  to?: string;
}) {
  const bg = {
    primary: 'bg-primary-50 text-primary-600',
    amber: 'bg-amber-50 text-amber-600',
    orange: 'bg-orange-50 text-orange-600',
    rose: 'bg-rose-50 text-rose-600',
  }[color];
  const content = (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">{label}</div>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bg)}>{icon}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900 mt-2">{value}</div>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function QuickLink({
  to,
  icon,
  children,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50/40 hover:text-primary-700 text-sm text-gray-700 transition"
    >
      <span className="text-gray-400">{icon}</span>
      {children}
    </Link>
  );
}
