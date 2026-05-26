import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Calendar,
  FileText,
  Flag,
  Link as LinkIcon,
  MoreHorizontal,
  Tag,
  Target,
  Trash2,
  User,
  UserCog,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ActivitySection } from '@/features/activities/activity-section';
import { AttachmentsSection } from '@/features/attachments/attachments-section';
import { authApi } from '@/features/auth/auth-api';
import { ChecklistSection } from '@/features/checklists/checklist-section';
import { CommentsSection } from '@/features/comments/comments-section';
import { projectsApi } from '@/features/projects/projects-api';
import { sprintsApi } from '@/features/sprints/sprints-api';
import { ManageLabelsDialog } from '@/features/tasks/manage-labels-dialog';
import { labelsApi, tasksApi } from '@/features/tasks/tasks-api';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BoardList } from '@/types/project';
import type { Priority, Task } from '@/types/task';

const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-amber-100 text-amber-700',
  URGENT: 'bg-rose-100 text-rose-700',
};

interface Props {
  taskId: number | null;
  lists: BoardList[];
  projectId: number;
  projectKey?: string;
  onClose: () => void;
}

type Tab = 'comments' | 'attachments' | 'activity';

export function TaskDetailPanel({ taskId, lists, projectId, projectKey, onClose }: Props) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('comments');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [labelsManagerOpen, setLabelsManagerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copiedHint, setCopiedHint] = useState<string | null>(null);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.get(taskId!),
    enabled: !!taskId,
  });

  const { data: labels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
    enabled: !!projectId,
  });

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
    enabled: !!projectId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectsApi.members(projectId),
    enabled: !!projectId,
  });

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

  useEffect(() => {
    if (task) {
      setDraftTitle(task.title);
      setDraftDescription(task.description ?? '');
    }
  }, [task]);

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<Task> & { version: number }) =>
      tasksApi.update(task!.id, {
        title: patch.title ?? task!.title,
        description: patch.description ?? task!.description ?? undefined,
        priority: patch.priority,
        assignee_id: patch.assignee_id,
        due_date: patch.due_date,
        label_ids: patch.label_ids,
        sprint_id: patch.sprint_id,
        version: patch.version,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['task', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['tasks', 'board', task?.board_id] });
      // Dashboard / Due-soon page cũng filter theo assignee → invalidate luôn
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.remove(task!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'board', task?.board_id] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      onClose();
    },
  });

  if (!taskId) return null;

  const list = task ? lists.find((l) => l.id === task.list_id) : null;
  const taskLabels = task?.label_ids?.map((id) => labels.find((l) => l.id === id)).filter(Boolean) ?? [];

  function saveTitle() {
    if (!task) return;
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed === task.title) return;
    updateMutation.mutate({ title: trimmed, version: task.version });
  }

  function saveDescription() {
    if (!task) return;
    setEditingDescription(false);
    if (draftDescription === (task.description ?? '')) return;
    updateMutation.mutate({ description: draftDescription, version: task.version });
  }

  function changePriority(p: Priority | null) {
    if (!task) return;
    updateMutation.mutate({ priority: p ?? undefined, version: task.version });
  }

  function toggleLabel(labelId: number) {
    if (!task) return;
    const current = task.label_ids ?? [];
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    updateMutation.mutate({ label_ids: next, version: task.version });
  }

  function changeSprint(sprintId: number | null) {
    if (!task) return;
    updateMutation.mutate({ sprint_id: sprintId, version: task.version });
  }

  function changeAssignee(userId: number | null) {
    if (!task) return;
    updateMutation.mutate({ assignee_id: userId, version: task.version });
  }

  async function copyToClipboard(value: string, hint: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedHint(hint);
      setTimeout(() => setCopiedHint(null), 1500);
    } catch {
      setCopiedHint('Không sao chép được');
      setTimeout(() => setCopiedHint(null), 1500);
    }
  }

  return (
    <aside className="fixed top-14 right-0 bottom-0 w-full sm:w-[480px] bg-white border-l border-gray-200 shadow-2xl flex flex-col z-40 animate-slide-in-right">
      <div className="p-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {list && (
                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-semibold">
                  {list.name}
                </span>
              )}
              <span>·</span>
              <span>{projectKey ?? 'TASK'}-{task?.id ?? '...'}</span>
            </div>
            {task ? (
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="text-xl font-bold text-gray-900 mt-2 w-full bg-transparent border-0 outline-none focus:bg-gray-50 rounded px-1 -mx-1"
              />
            ) : (
              <div className="h-7 mt-2 bg-gray-100 rounded animate-pulse w-2/3" />
            )}
          </div>
          <div className="flex items-center gap-1">
            {confirmDelete ? (
              <div className="flex items-center gap-1 mr-1">
                <span className="text-xs font-semibold text-rose-600">Xoá task?</span>
                <button
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="px-2 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Đang xoá…' : 'Xoá'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Huỷ
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-gray-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg"
                title="Xoá task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                  title="Thao tác khác"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1" align="end">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `${window.location.origin}/projects/${projectId}?task=${taskId}`,
                      'Đã sao chép link',
                    )
                  }
                  className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-gray-700 hover:bg-gray-50 rounded"
                >
                  <LinkIcon className="w-3.5 h-3.5 text-gray-400" /> Sao chép link task
                </button>
                {copiedHint && (
                  <div className="px-2.5 py-1 text-[11px] text-emerald-700 bg-emerald-50 rounded mt-1">
                    {copiedHint}
                  </div>
                )}
              </PopoverContent>
            </Popover>
            <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg" title="Đóng">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading || !task ? (
          <div className="p-5 space-y-3">
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
          </div>
        ) : (
          <>
            <div className="p-5 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <RowLabel icon={<User className="w-4 h-4" />}>Assignee</RowLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-2 text-left hover:bg-gray-50 rounded px-1 -mx-1 transition min-h-[28px]">
                    {task.assignee_id ? (
                      <>
                        <Avatar
                          seed={task.assignee_id}
                          name={
                            userMap.get(task.assignee_id)?.full_name ??
                            userMap.get(task.assignee_id)?.username ??
                            `U${task.assignee_id}`
                          }
                          size="sm"
                        />
                        <span className="text-gray-900">
                          {userMap.get(task.assignee_id)?.full_name ??
                            userMap.get(task.assignee_id)?.username ??
                            `Người dùng #${task.assignee_id}`}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">+ Chọn người thực hiện</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="text-xs font-semibold text-gray-700 px-2 py-1">
                    Người thực hiện
                  </div>
                  <div className="max-h-60 overflow-y-auto scrollbar-thin">
                    <button
                      onClick={() => changeAssignee(null)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left"
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
                        ?
                      </div>
                      <span className="text-xs text-gray-700 flex-1">Bỏ giao</span>
                      {task.assignee_id == null && (
                        <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                      )}
                    </button>
                    {members.length === 0 ? (
                      <p className="text-xs text-gray-400 italic px-2 py-2">
                        Project chưa có thành viên.
                      </p>
                    ) : (
                      members.map((m) => {
                        const u = userMap.get(m.user_id);
                        const active = task.assignee_id === m.user_id;
                        return (
                          <button
                            key={m.id}
                            onClick={() => changeAssignee(m.user_id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left"
                          >
                            <Avatar
                              seed={m.user_id}
                              name={u?.full_name ?? u?.username ?? `U${m.user_id}`}
                              size="sm"
                            />
                            <span className="text-xs text-gray-700 flex-1 truncate">
                              {u?.full_name ?? u?.username ?? `Người dùng #${m.user_id}`}
                            </span>
                            {active && (
                              <span className="text-[10px] text-emerald-600 font-bold">✓</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <RowLabel icon={<UserCog className="w-4 h-4" />}>Reporter</RowLabel>
              <div className="text-gray-700 flex items-center gap-2">
                {task.reporter_id ? (
                  <>
                    <Avatar
                      seed={task.reporter_id}
                      name={
                        userMap.get(task.reporter_id)?.full_name ??
                        userMap.get(task.reporter_id)?.username ??
                        `U${task.reporter_id}`
                      }
                      size="sm"
                    />
                    <span className="text-gray-900">
                      {userMap.get(task.reporter_id)?.full_name ??
                        userMap.get(task.reporter_id)?.username ??
                        `Người dùng #${task.reporter_id}`}
                    </span>
                  </>
                ) : (
                  '—'
                )}
              </div>

              <RowLabel icon={<Calendar className="w-4 h-4" />}>Hết hạn</RowLabel>
              <div className="text-gray-700">
                {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
              </div>

              <RowLabel icon={<Flag className="w-4 h-4" />}>Priority</RowLabel>
              <div className="flex flex-wrap gap-1">
                {PRIORITY_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => changePriority(task.priority === p ? null : p)}
                    className={cn(
                      'px-2 py-0.5 text-[10px] font-semibold rounded transition border',
                      task.priority === p
                        ? `${PRIORITY_BADGE[p]} border-transparent`
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50',
                    )}
                  >
                    {p === 'URGENT' && <AlertCircle className="w-3 h-3 inline mr-1" />}
                    {p}
                  </button>
                ))}
              </div>

              <RowLabel icon={<Tag className="w-4 h-4" />}>Labels</RowLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex flex-wrap gap-1 items-center min-h-[28px] text-left hover:bg-gray-50 rounded px-1 -mx-1 transition">
                    {taskLabels.length > 0 ? (
                      taskLabels.map((l) =>
                        l ? (
                          <span
                            key={l.id}
                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                            style={{ backgroundColor: `${l.color}20`, color: l.color }}
                          >
                            {l.name}
                          </span>
                        ) : null,
                      )
                    ) : (
                      <span className="text-xs text-gray-400">+ Thêm nhãn</span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="text-xs font-semibold text-gray-700 px-2 py-1">Chọn nhãn</div>
                  <div className="max-h-60 overflow-y-auto scrollbar-thin">
                    {labels.length === 0 ? (
                      <p className="text-xs text-gray-400 italic px-2 py-2">
                        Project chưa có nhãn. Tạo nhãn mới bên dưới.
                      </p>
                    ) : (
                      labels.map((l) => {
                        const checked = (task.label_ids ?? []).includes(l.id);
                        return (
                          <button
                            key={l.id}
                            onClick={() => toggleLabel(l.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-50 text-left"
                          >
                            <span
                              className={cn(
                                'w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                                checked
                                  ? 'bg-primary-600 border-primary-600 text-white'
                                  : 'border-gray-300 bg-white',
                              )}
                            >
                              {checked ? '✓' : ''}
                            </span>
                            <span
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                              style={{ backgroundColor: `${l.color}20`, color: l.color }}
                            >
                              {l.name}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => setLabelsManagerOpen(true)}
                      className="w-full px-2 py-1.5 text-xs text-primary-700 hover:bg-primary-50 rounded text-left flex items-center gap-1.5"
                    >
                      <Tag className="w-3.5 h-3.5" /> Quản lý nhãn của project…
                    </button>
                  </div>
                </PopoverContent>
              </Popover>

              <RowLabel icon={<Target className="w-4 h-4" />}>Sprint</RowLabel>
              <div>
                {sprints.length === 0 ? (
                  <span className="text-xs text-gray-400 italic">Project chưa có sprint</span>
                ) : (
                  <select
                    value={task.sprint_id ?? ''}
                    onChange={(e) => changeSprint(e.target.value ? Number(e.target.value) : null)}
                    className="text-xs px-2 py-1 bg-white border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Không gắn sprint</option>
                    {sprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                  </select>
                )}
              </div>

            </div>

            <div className="px-5 pb-4 border-t border-gray-100 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Mô tả
              </h3>
              {editingDescription ? (
                <div>
                  <textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    rows={4}
                    className="w-full p-2 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5 mt-1.5">
                    <button onClick={() => setEditingDescription(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                      Huỷ
                    </button>
                    <button onClick={saveDescription} className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded">
                      Lưu
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap cursor-text hover:bg-gray-50 rounded p-2 -m-2 min-h-[2.5rem]"
                  onClick={() => setEditingDescription(true)}
                >
                  {task.description ? (
                    task.description
                  ) : (
                    <span className="text-gray-400">Chưa có mô tả. Click để thêm…</span>
                  )}
                </div>
              )}
            </div>

            <ChecklistSection taskId={task.id} />

            <div className="border-t border-gray-100 bg-gray-50">
              <div className="px-5 flex gap-1">
                <TabBtn active={tab === 'comments'} onClick={() => setTab('comments')}>Comments</TabBtn>
                <TabBtn active={tab === 'attachments'} onClick={() => setTab('attachments')}>Attachments</TabBtn>
                <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</TabBtn>
              </div>
            </div>

            <div>
              {tab === 'comments' && <CommentsSection taskId={task.id} userMap={userMap} />}
              {tab === 'attachments' && <AttachmentsSection taskId={task.id} userMap={userMap} />}
              {tab === 'activity' && <ActivitySection taskId={task.id} />}
            </div>
          </>
        )}
      </div>

      {updateMutation.isError && (
        <div className="px-5 py-2 text-xs text-rose-600 bg-rose-50 border-t border-rose-200">
          {extractErrorMessage(updateMutation.error)}
        </div>
      )}

      {labelsManagerOpen && (
        <ManageLabelsDialog
          open={labelsManagerOpen}
          onOpenChange={setLabelsManagerOpen}
          projectId={projectId}
        />
      )}
    </aside>
  );
}

function RowLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-gray-500">{icon}{children}</div>;
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-3 text-sm font-medium -mb-px border-b-2 transition',
        active ? 'text-primary-600 border-primary-600' : 'text-gray-500 border-transparent hover:text-gray-700',
      )}
    >
      {children}
    </button>
  );
}
