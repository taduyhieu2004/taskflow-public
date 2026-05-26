import { useQueries, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Flag,
  Pencil,
  Play,
  Target,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { authApi } from '@/features/auth/auth-api';
import { projectsApi } from '@/features/projects/projects-api';
import { SprintFormDialog } from '@/features/sprints/sprint-form-dialog';
import { sprintsApi } from '@/features/sprints/sprints-api';
import { tasksApi } from '@/features/tasks/tasks-api';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Priority, Task } from '@/types/task';
import type { Sprint, SprintStatus } from '@/types/sprint';

const STATUS_META: Record<SprintStatus, { label: string; badge: string; icon: React.ReactNode }> = {
  PLANNING: {
    label: 'Đang lên kế hoạch',
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: <CircleDot className="w-3.5 h-3.5" />,
  },
  ACTIVE: {
    label: 'Đang chạy',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: <Play className="w-3.5 h-3.5" />,
  },
  CLOSED: {
    label: 'Đã đóng',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
};

const PRIORITY_META: Record<Priority, { color: string; bar: string }> = {
  URGENT: { color: 'text-rose-700 bg-rose-50 border-rose-200', bar: 'bg-rose-500' },
  HIGH: { color: 'text-amber-700 bg-amber-50 border-amber-200', bar: 'bg-amber-500' },
  MEDIUM: { color: 'text-blue-700 bg-blue-50 border-blue-200', bar: 'bg-blue-500' },
  LOW: { color: 'text-slate-700 bg-slate-50 border-slate-200', bar: 'bg-slate-400' },
};

function fmtDate(ts?: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function daysBetween(a: number, b: number) {
  return Math.ceil((b - a) / (24 * 60 * 60 * 1000));
}

export function SprintDetailPage() {
  const { projectId: projectIdParam, sprintId: sprintIdParam } = useParams();
  const projectId = Number(projectIdParam);
  const sprintId = Number(sprintIdParam);

  const [editOpen, setEditOpen] = useState(false);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  });

  const sprintsQuery = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
    enabled: !!projectId,
  });

  const boardsQuery = useQuery({
    queryKey: ['boards', projectId],
    queryFn: () => projectsApi.boards(projectId),
    enabled: !!projectId,
  });

  const boardId = boardsQuery.data?.[0]?.id ?? null;

  const boardDetailQuery = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => projectsApi.board(boardId!),
    enabled: !!boardId,
  });

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'sprint', sprintId],
    queryFn: () =>
      tasksApi.list({
        project_id: projectId,
        sprint_id: sprintId,
        size: 500,
      }),
    enabled: !!projectId && !!sprintId,
  });

  const membersQuery = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectsApi.members(projectId),
    enabled: !!projectId,
  });

  const members = membersQuery.data ?? [];

  const userQueries = useQueries({
    queries: members.map((m) => ({
      queryKey: ['user', m.user_id],
      queryFn: () => authApi.getUser(m.user_id),
      staleTime: 5 * 60_000,
    })),
  });

  const userMap = useMemo(() => {
    const map = new Map<number, import('@/types/auth').User>();
    userQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [userQueries]);

  const sprint: Sprint | null = useMemo(
    () => sprintsQuery.data?.find((s) => s.id === sprintId) ?? null,
    [sprintsQuery.data, sprintId],
  );

  const lists = useMemo(
    () => (boardDetailQuery.data?.lists ?? []).slice().sort((a, b) => a.position - b.position),
    [boardDetailQuery.data],
  );

  const listMap = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const tasks = tasksQuery.data?.content ?? [];

  const isFrozen = sprint?.status === 'CLOSED' && sprint?.closed_at != null;

  const stats = useMemo(() => {
    const now = Date.now();
    const lastListId = lists.length > 0 ? lists[lists.length - 1].id : null;

    // Đếm sống cho 3 chỉ số chính, override bằng snapshot nếu sprint đã CLOSED
    let total = tasks.length;
    let done = lastListId == null ? 0 : tasks.filter((t) => t.list_id === lastListId).length;
    let overdue = tasks.filter((t) => {
      const isDone = lastListId != null && t.list_id === lastListId;
      return !isDone && t.due_date != null && t.due_date < now;
    }).length;

    if (isFrozen && sprint) {
      total = sprint.closed_total_tasks ?? total;
      done = sprint.closed_done_tasks ?? done;
      overdue = sprint.closed_overdue_tasks ?? overdue;
    }

    const completionPct = total === 0 ? 0 : Math.round((done / total) * 100);

    // Các breakdown vẫn đếm sống (không freeze) — chỉ để tham khảo task list hiện tại
    const byList = new Map<number, Task[]>();
    lists.forEach((l) => byList.set(l.id, []));
    tasks.forEach((t) => {
      if (!byList.has(t.list_id)) byList.set(t.list_id, []);
      byList.get(t.list_id)!.push(t);
    });

    const byPriority = new Map<Priority | 'NONE', number>();
    (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).forEach((p) => byPriority.set(p, 0));
    byPriority.set('NONE', 0);
    tasks.forEach((t) => {
      const key = (t.priority ?? 'NONE') as Priority | 'NONE';
      byPriority.set(key, (byPriority.get(key) ?? 0) + 1);
    });

    const byAssignee = new Map<number | 'UNASSIGNED', number>();
    tasks.forEach((t) => {
      const key = (t.assignee_id ?? 'UNASSIGNED') as number | 'UNASSIGNED';
      byAssignee.set(key, (byAssignee.get(key) ?? 0) + 1);
    });

    return { total, overdue, done, completionPct, byList, byPriority, byAssignee };
  }, [tasks, lists, isFrozen, sprint]);

  const sprintProgress = useMemo(() => {
    if (!sprint?.start_date || !sprint?.end_date) return null;
    const now = Date.now();
    const total = sprint.end_date - sprint.start_date;
    if (total <= 0) return null;
    const elapsed = Math.max(0, Math.min(total, now - sprint.start_date));
    const pct = Math.round((elapsed / total) * 100);
    const daysLeft = daysBetween(now, sprint.end_date);
    return { pct, daysLeft };
  }, [sprint]);

  if (sprintsQuery.isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="h-6 bg-gray-100 rounded animate-pulse w-1/3" />
        <div className="h-32 bg-gray-100 rounded animate-pulse mt-4" />
      </div>
    );
  }

  if (!sprint) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <Link to={`/projects/${projectId}/sprints`} className="text-sm text-primary-600">
          ← Quay lại danh sách sprint
        </Link>
        <div className="mt-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg px-4 py-3 text-sm">
          Không tìm thấy sprint.
        </div>
      </div>
    );
  }

  const meta = STATUS_META[sprint.status];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/projects" className="hover:text-gray-700">
          Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/projects/${projectId}`} className="hover:text-gray-700">
          {projectQuery.data?.name ?? '...'}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/projects/${projectId}/sprints`} className="hover:text-gray-700">
          Sprints
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium truncate">{sprint.name}</span>
      </div>

      {isFrozen && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-base">📌</span>
          <div className="text-xs text-gray-700">
            <span className="font-semibold">Số liệu đã chốt lúc đóng sprint</span>
            {sprint.closed_at && (
              <span className="text-gray-500">
                {' '}({new Date(sprint.closed_at).toLocaleString('vi-VN')}).
              </span>
            )}
            <br />
            <span className="text-gray-500">
              Task list bên dưới vẫn cập nhật theo trạng thái thực tế (tham khảo). Mở lại sprint
              để chuyển về đếm sống.
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mt-3 bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Target className="w-5 h-5 text-primary-600" />
              <h1 className="text-xl font-bold text-gray-900">{sprint.name}</h1>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border rounded',
                  meta.badge,
                )}
              >
                {meta.icon} {meta.label}
              </span>
            </div>
            {sprint.goal && (
              <p className="text-sm text-gray-600 mt-2 flex items-start gap-1.5">
                <Flag className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                <span>{sprint.goal}</span>
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {fmtDate(sprint.start_date)} —{' '}
                {fmtDate(sprint.end_date)}
              </span>
              {sprintProgress && sprint.status === 'ACTIVE' && (
                <span className="text-emerald-700 font-medium">
                  {sprintProgress.daysLeft > 0
                    ? `Còn ${sprintProgress.daysLeft} ngày`
                    : sprintProgress.daysLeft === 0
                      ? 'Hôm nay là ngày cuối'
                      : `Quá hạn ${Math.abs(sprintProgress.daysLeft)} ngày`}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition"
            title="Sửa sprint"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {sprintProgress && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Tiến độ thời gian</span>
              <span>{sprintProgress.pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all',
                  sprintProgress.pct >= 100 ? 'bg-rose-500' : 'bg-primary-500',
                )}
                style={{ width: `${Math.min(100, sprintProgress.pct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {tasksQuery.isError && (
        <div className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {extractErrorMessage(tasksQuery.error)}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <StatBox label="Tổng task" value={stats.total} icon={<CircleDot className="w-4 h-4" />} color="primary" />
        <StatBox
          label="Hoàn thành"
          value={`${stats.done}/${stats.total}`}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="emerald"
          extra={`${stats.completionPct}%`}
        />
        <StatBox
          label="Quá hạn"
          value={stats.overdue}
          icon={<AlertTriangle className="w-4 h-4" />}
          color="rose"
        />
        <StatBox
          label="Chưa giao"
          value={stats.byAssignee.get('UNASSIGNED') ?? 0}
          icon={<UserCheck className="w-4 h-4" />}
          color="amber"
        />
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span className="font-medium">Tiến độ task</span>
          <span>{stats.completionPct}% hoàn thành</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
          {lists.map((l, idx) => {
            const count = stats.byList.get(l.id)?.length ?? 0;
            if (stats.total === 0 || count === 0) return null;
            const pct = (count / stats.total) * 100;
            const isLast = idx === lists.length - 1;
            return (
              <div
                key={l.id}
                className={cn('h-full', isLast ? 'bg-emerald-500' : idx === 0 ? 'bg-slate-300' : 'bg-amber-400')}
                style={{ width: `${pct}%` }}
                title={`${l.name}: ${count}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 mt-1.5">
          {lists.map((l, idx) => {
            const count = stats.byList.get(l.id)?.length ?? 0;
            const isLast = idx === lists.length - 1;
            return (
              <span key={l.id} className="inline-flex items-center gap-1">
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    isLast ? 'bg-emerald-500' : idx === 0 ? 'bg-slate-300' : 'bg-amber-400',
                  )}
                />
                {l.name}: <span className="font-medium text-gray-700">{count}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Theo độ ưu tiên</h2>
          {stats.total === 0 ? (
            <p className="text-xs text-gray-400 italic">Chưa có task.</p>
          ) : (
            <div className="space-y-2">
              {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => {
                const count = stats.byPriority.get(p) ?? 0;
                const pct = stats.total === 0 ? 0 : (count / stats.total) * 100;
                return (
                  <div key={p}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-gray-700">
                        {p === 'URGENT' && <AlertCircle className="w-3 h-3 inline -mt-0.5 mr-1" />}
                        {p}
                      </span>
                      <span className="text-gray-500">{count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                      <div className={cn('h-full', PRIORITY_META[p].bar)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {(stats.byPriority.get('NONE') ?? 0) > 0 && (
                <div className="text-xs text-gray-500 pt-1">
                  Không gắn priority: <span className="font-medium">{stats.byPriority.get('NONE')}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Theo người thực hiện</h2>
          {stats.total === 0 ? (
            <p className="text-xs text-gray-400 italic">Chưa có task.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin pr-1">
              {Array.from(stats.byAssignee.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([key, count]) => {
                  const pct = stats.total === 0 ? 0 : (count / stats.total) * 100;
                  const u = typeof key === 'number' ? userMap.get(key) : null;
                  const label =
                    key === 'UNASSIGNED'
                      ? 'Chưa giao'
                      : (u?.full_name ?? u?.username ?? `Người dùng #${key}`);
                  return (
                    <div key={key} className="flex items-center gap-2">
                      {typeof key === 'number' ? (
                        <Avatar seed={key} name={label} size="xs" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                          ?
                        </div>
                      )}
                      <span className="text-xs text-gray-700 flex-1 truncate">{label}</span>
                      <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Task list */}
      <div className="mt-5 bg-white border border-gray-200 rounded-xl">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Danh sách task ({stats.total})</h2>
          <Link
            to={`/projects/${projectId}?sprint=${sprintId}`}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
          >
            Mở trên board →
          </Link>
        </div>
        {tasksQuery.isLoading ? (
          <div className="p-4 text-sm text-gray-400">Đang tải…</div>
        ) : stats.total === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Chưa có task nào được gán vào sprint này.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tasks.map((t) => {
              const list = listMap.get(t.list_id);
              const u = t.assignee_id ? userMap.get(t.assignee_id) : null;
              const overdue = t.due_date != null && t.due_date < Date.now();
              return (
                <li key={t.id} className="px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm">
                  <Link
                    to={`/projects/${projectId}?task=${t.id}`}
                    className="flex-1 font-medium text-gray-900 hover:text-primary-700 truncate"
                  >
                    {t.title}
                  </Link>
                  {t.priority && (
                    <span
                      className={cn(
                        'px-1.5 py-0.5 text-[10px] font-semibold rounded border',
                        PRIORITY_META[t.priority].color,
                      )}
                    >
                      {t.priority}
                    </span>
                  )}
                  {list && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gray-100 text-gray-700">
                      {list.name}
                    </span>
                  )}
                  {t.due_date && (
                    <span
                      className={cn(
                        'text-[11px] inline-flex items-center gap-1',
                        overdue ? 'text-rose-600 font-medium' : 'text-gray-500',
                      )}
                    >
                      <Calendar className="w-3 h-3" />
                      {new Date(t.due_date).toLocaleDateString('vi-VN', {
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </span>
                  )}
                  {u ? (
                    <Avatar seed={u.id} name={u.full_name ?? u.username} size="xs" />
                  ) : t.assignee_id ? (
                    <Avatar seed={t.assignee_id} name={`U${t.assignee_id}`} size="xs" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                      ?
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <SprintFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        sprint={sprint}
      />
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
  color,
  extra,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'primary' | 'emerald' | 'rose' | 'amber';
  extra?: string;
}) {
  const bg = {
    primary: 'bg-primary-50 text-primary-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-600',
  }[color];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">{label}</div>
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', bg)}>{icon}</div>
      </div>
      <div className="text-xl font-bold text-gray-900 mt-1">
        {value} {extra && <span className="text-xs font-normal text-gray-500">({extra})</span>}
      </div>
    </div>
  );
}
