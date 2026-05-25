import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Flag,
  Pencil,
  Play,
  Plus,
  Square,
  Target,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectsApi } from '@/features/projects/projects-api';
import { SprintFormDialog } from '@/features/sprints/sprint-form-dialog';
import { sprintsApi } from '@/features/sprints/sprints-api';
import { tasksApi } from '@/features/tasks/tasks-api';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
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

function fmtDate(ts?: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function SprintsPage() {
  const { projectId: projectIdParam } = useParams();
  const projectId = Number(projectIdParam);
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

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

  // Fetch all tasks of the project once, then compute per-sprint stats locally
  const projectTasksQuery = useQuery({
    queryKey: ['tasks', 'project', projectId, 'for-sprint-stats'],
    queryFn: () => tasksApi.list({ project_id: projectId, size: 500 }),
    enabled: !!projectId,
  });

  const lists = useMemo(
    () => (boardDetailQuery.data?.lists ?? []).slice().sort((a, b) => a.position - b.position),
    [boardDetailQuery.data],
  );
  const lastListId = lists.length > 0 ? lists[lists.length - 1].id : null;

  const taskStatsBySprint = useMemo(() => {
    const map = new Map<number, { total: number; done: number }>();
    const all = projectTasksQuery.data?.content ?? [];
    for (const t of all) {
      if (t.sprint_id == null) continue;
      const cur = map.get(t.sprint_id) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (lastListId != null && t.list_id === lastListId) cur.done += 1;
      map.set(t.sprint_id, cur);
    }
    return map;
  }, [projectTasksQuery.data, lastListId]);

  const statusMutation = useMutation({
    mutationFn: ({ sprint, status }: { sprint: Sprint; status: SprintStatus }) =>
      sprintsApi.update(sprint.id, {
        name: sprint.name,
        goal: sprint.goal ?? undefined,
        start_date: sprint.start_date ?? null,
        end_date: sprint.end_date ?? null,
        status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
    },
  });

  const sprints = sprintsQuery.data ?? [];

  const grouped = useMemo(() => {
    const active = sprints.filter((s) => s.status === 'ACTIVE');
    const planning = sprints.filter((s) => s.status === 'PLANNING');
    const closed = sprints.filter((s) => s.status === 'CLOSED');
    return { active, planning, closed };
  }, [sprints]);

  const project = projectQuery.data;

  function openCreate() {
    setEditingSprint(null);
    setDialogOpen(true);
  }

  function openEdit(s: Sprint) {
    setEditingSprint(s);
    setDialogOpen(true);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/projects" className="hover:text-gray-700">
          Projects
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link to={`/projects/${projectId}`} className="hover:text-gray-700">
          {project?.name ?? '...'}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">Sprints</span>
      </div>

      <div className="flex items-end justify-between mt-3 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-primary-600" /> Sprints
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý các sprint của project. Mỗi project có thể có nhiều sprint nhưng chỉ nên có 1
            sprint <em>ACTIVE</em> tại một thời điểm.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-3 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Tạo sprint
        </button>
      </div>

      {sprintsQuery.isError && (
        <div className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {extractErrorMessage(sprintsQuery.error)}
        </div>
      )}

      {statusMutation.isError && (
        <div className="mt-4 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {extractErrorMessage(statusMutation.error)}
        </div>
      )}

      {sprintsQuery.isLoading ? (
        <div className="mt-6 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-28" />
          ))}
        </div>
      ) : sprints.length === 0 ? (
        <div className="mt-6 bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Project này chưa có sprint nào.</p>
          <button
            onClick={openCreate}
            className="mt-4 px-3 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white rounded-lg inline-flex items-center gap-1.5 shadow-sm transition"
          >
            <Plus className="w-4 h-4" /> Tạo sprint đầu tiên
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.active.length > 0 && (
            <Section title="Đang chạy" count={grouped.active.length}>
              {grouped.active.map((s) => (
                <SprintCard
                  key={s.id}
                  sprint={s}
                  stats={taskStatsBySprint.get(s.id)}
                  projectId={projectId}
                  onEdit={() => openEdit(s)}
                  onChangeStatus={(status) => statusMutation.mutate({ sprint: s, status })}
                  isPending={statusMutation.isPending}
                />
              ))}
            </Section>
          )}

          {grouped.planning.length > 0 && (
            <Section title="Sắp tới" count={grouped.planning.length}>
              {grouped.planning.map((s) => (
                <SprintCard
                  key={s.id}
                  sprint={s}
                  stats={taskStatsBySprint.get(s.id)}
                  projectId={projectId}
                  onEdit={() => openEdit(s)}
                  onChangeStatus={(status) => statusMutation.mutate({ sprint: s, status })}
                  isPending={statusMutation.isPending}
                />
              ))}
            </Section>
          )}

          {grouped.closed.length > 0 && (
            <Section title="Đã đóng" count={grouped.closed.length} muted>
              {grouped.closed.map((s) => (
                <SprintCard
                  key={s.id}
                  sprint={s}
                  stats={taskStatsBySprint.get(s.id)}
                  projectId={projectId}
                  onEdit={() => openEdit(s)}
                  onChangeStatus={(status) => statusMutation.mutate({ sprint: s, status })}
                  isPending={statusMutation.isPending}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      <SprintFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        sprint={editingSprint}
      />
    </div>
  );
}

function Section({
  title,
  count,
  muted,
  children,
}: {
  title: string;
  count: number;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2
        className={cn(
          'text-sm font-semibold uppercase tracking-wider mb-3',
          muted ? 'text-gray-400' : 'text-gray-700',
        )}
      >
        {title} <span className="font-normal text-gray-400">({count})</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SprintCard({
  sprint,
  stats,
  projectId,
  onEdit,
  onChangeStatus,
  isPending,
}: {
  sprint: Sprint;
  stats?: { total: number; done: number };
  projectId: number;
  onEdit: () => void;
  onChangeStatus: (s: SprintStatus) => void;
  isPending: boolean;
}) {
  const meta = STATUS_META[sprint.status];
  const isClosed = sprint.status === 'CLOSED';
  const isFrozen = isClosed && sprint.closed_at != null;
  // Khi CLOSED: ưu tiên dùng snapshot, fallback đếm sống nếu chưa có snapshot (sprint cũ trước khi feature ra)
  const total = isFrozen ? (sprint.closed_total_tasks ?? stats?.total ?? 0) : (stats?.total ?? 0);
  const done = isFrozen ? (sprint.closed_done_tasks ?? stats?.done ?? 0) : (stats?.done ?? 0);
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-5 transition hover:shadow-sm',
        sprint.status === 'ACTIVE'
          ? 'border-emerald-300 ring-1 ring-emerald-100'
          : 'border-gray-200',
        isClosed && 'opacity-75',
      )}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{sprint.name}</h3>
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
            <p className="text-sm text-gray-600 mt-1.5 flex items-start gap-1.5">
              <Flag className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
              <span>{sprint.goal}</span>
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> {fmtDate(sprint.start_date)} —{' '}
              {fmtDate(sprint.end_date)}
            </span>
            <span className="text-gray-300">·</span>
            <span>
              <span className="font-medium text-gray-700">{total}</span> task
              {total > 0 && (
                <> · {done}/{total} hoàn thành ({pct}%)</>
              )}
            </span>
          </div>

          {total > 0 && (
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-md">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {sprint.status === 'PLANNING' && (
            <button
              onClick={() => onChangeStatus('ACTIVE')}
              disabled={isPending}
              className="px-2.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg inline-flex items-center gap-1 transition disabled:opacity-50"
              title="Bắt đầu sprint"
            >
              <Play className="w-3.5 h-3.5" /> Bắt đầu
            </button>
          )}
          {sprint.status === 'ACTIVE' && (
            <button
              onClick={() => onChangeStatus('CLOSED')}
              disabled={isPending}
              className="px-2.5 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-800 text-white rounded-lg inline-flex items-center gap-1 transition disabled:opacity-50"
              title="Đóng sprint"
            >
              <Square className="w-3.5 h-3.5" /> Đóng sprint
            </button>
          )}
          <Link
            to={`/projects/${projectId}/sprints/${sprint.id}`}
            className="px-2.5 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50 border border-primary-200 rounded-lg inline-flex items-center gap-1 transition"
            title="Xem chi tiết sprint"
          >
            Chi tiết <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            onClick={onEdit}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition"
            title="Sửa"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
