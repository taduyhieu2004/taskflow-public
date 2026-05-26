import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Calendar, FileText, Flag, Tag, Target, User } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authApi } from '@/features/auth/auth-api';
import { projectsApi } from '@/features/projects/projects-api';
import { sprintsApi } from '@/features/sprints/sprints-api';
import { labelsApi, tasksApi } from '@/features/tasks/tasks-api';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Priority } from '@/types/task';

interface Props {
  listId: number;
  boardId: number;
  projectId: number;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW: 'border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100',
  MEDIUM: 'border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100',
  HIGH: 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100',
  URGENT: 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100',
};

const PRIORITY_ACTIVE_BADGE: Record<Priority, string> = {
  LOW: 'bg-slate-500 text-white border-slate-600',
  MEDIUM: 'bg-blue-600 text-white border-blue-700',
  HIGH: 'bg-amber-500 text-white border-amber-600',
  URGENT: 'bg-rose-600 text-white border-rose-700',
};

export function CreateTaskDialog({ listId, boardId, projectId, onClose }: Props) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [sprintId, setSprintId] = useState<number | null>(null);

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId),
    enabled: !!projectId,
  });

  // Fetch project members
  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectsApi.members(projectId),
    enabled: !!projectId,
  });

  // Fetch user profiles for members to get names
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

  // Fetch project labels
  const { data: labels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'board', boardId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      onClose();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    mutation.mutate({
      list_id: listId,
      title: trimmedTitle,
      description: description.trim() || undefined,
      assignee_id: assigneeId || undefined,
      priority,
      label_ids: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
      due_date: dueDate ? new Date(dueDate).getTime() : undefined,
      sprint_id: sprintId || undefined,
    });
  }

  function toggleLabel(id: number) {
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((labelId) => labelId !== id) : [...prev, id],
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>Tạo task mới</DialogTitle>
          <DialogDescription>Nhập đầy đủ thông tin để thêm task vào cột.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Tiêu đề <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Nhập tiêu đề task…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-gray-400" /> Mô tả
            </label>
            <textarea
              placeholder="Nhập mô tả task (tuỳ chọn)…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full text-sm px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none transition scrollbar-thin"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Assignee */}
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" /> Người thực hiện
              </label>
              <div className="relative">
                <select
                  value={assigneeId || ''}
                  onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full text-sm pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition appearance-none"
                >
                  <option value="">Chưa giao</option>
                  {members.map((m) => {
                    const u = userMap.get(m.user_id);
                    return (
                      <option key={m.id} value={m.user_id}>
                        {u?.full_name ?? u?.username ?? `Người dùng #${m.user_id}`}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {assigneeId ? (
                    <Avatar
                      seed={assigneeId}
                      name={userMap.get(assigneeId)?.full_name ?? `U${assigneeId}`}
                      size="xs"
                    />
                  ) : (
                    <User className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Due Date */}
            <div>
              <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" /> Hạn hoàn thành
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-gray-400" /> Độ ưu tiên
            </label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => {
                const isActive = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={cn(
                      'flex-1 text-center py-1.5 text-xs font-semibold border rounded-lg transition-all duration-200 flex items-center justify-center gap-1',
                      isActive ? PRIORITY_ACTIVE_BADGE[p] : PRIORITY_BADGE[p],
                    )}
                  >
                    {p === 'URGENT' && <AlertCircle className="w-3 h-3" />}
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sprint */}
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-gray-400" /> Sprint
            </label>
            {sprints.length === 0 ? (
              <div className="text-xs text-gray-400 italic">Project chưa có sprint.</div>
            ) : (
              <select
                value={sprintId ?? ''}
                onChange={(e) => setSprintId(e.target.value ? Number(e.target.value) : null)}
                className="w-full text-sm px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
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

          {/* Labels */}
          <div>
            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-gray-400" /> Nhãn
            </label>
            {labels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const isSelected = selectedLabelIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLabel(l.id)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all duration-200',
                        isSelected
                          ? 'text-white border-transparent'
                          : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-200',
                      )}
                      style={
                        isSelected ? { backgroundColor: l.color } : { borderColor: `${l.color}40` }
                      }
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-400 italic">Project này chưa có nhãn nào.</div>
            )}
          </div>

          {mutation.isError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
              {extractErrorMessage(mutation.error)}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              Huỷ
            </Button>
            <Button type="submit" disabled={!title.trim() || mutation.isPending}>
              {mutation.isPending ? 'Đang tạo…' : 'Tạo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
