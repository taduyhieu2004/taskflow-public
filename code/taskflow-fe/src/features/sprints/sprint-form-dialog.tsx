import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
import { sprintsApi } from '@/features/sprints/sprints-api';
import { extractErrorMessage } from '@/lib/api';
import type { Sprint, SprintStatus } from '@/types/sprint';

const STATUS_OPTIONS: SprintStatus[] = ['PLANNING', 'ACTIVE', 'CLOSED'];

function toDateInput(ts?: number | null) {
  if (!ts) return '';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInput(s: string): number | null {
  if (!s) return null;
  const ts = Date.parse(`${s}T00:00:00`);
  return Number.isNaN(ts) ? null : ts;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  sprint?: Sprint | null;
}

export function SprintFormDialog({ open, onOpenChange, projectId, sprint }: Props) {
  const queryClient = useQueryClient();
  const editing = !!sprint;

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<SprintStatus>('PLANNING');

  useEffect(() => {
    if (open) {
      setName(sprint?.name ?? '');
      setGoal(sprint?.goal ?? '');
      setStartDate(toDateInput(sprint?.start_date));
      setEndDate(toDateInput(sprint?.end_date));
      setStatus(sprint?.status ?? 'PLANNING');
    }
  }, [open, sprint]);

  const startTs = fromDateInput(startDate);
  const endTs = fromDateInput(endDate);
  const dateError =
    startTs != null && endTs != null && endTs < startTs
      ? 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'
      : null;

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        goal: goal.trim() || undefined,
        start_date: startTs,
        end_date: endTs,
        status,
      };
      if (editing) return sprintsApi.update(sprint!.id, payload);
      return sprintsApi.create(projectId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      onOpenChange(false);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || dateError) return;
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Sửa sprint' : 'Tạo sprint mới'}</DialogTitle>
          <DialogDescription>
            Sprint là chu kỳ làm việc cố định, dùng để gom các task cần hoàn thành cùng nhau.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-700">Tên sprint *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              placeholder="VD: Sprint 1 - MVP login"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">Mục tiêu</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Mục tiêu của sprint này…"
              className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">Ngày bắt đầu</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">Ngày kết thúc</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className={`mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${dateError ? 'border-rose-300' : 'border-gray-300'}`}
              />
            </div>
          </div>
          {dateError && <p className="text-xs text-rose-600">{dateError}</p>}

          {editing && (
            <div>
              <label className="text-xs font-semibold text-gray-700">Trạng thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SprintStatus)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {mutation.isError && (
            <p className="text-xs text-rose-600">{extractErrorMessage(mutation.error)}</p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="sm">
                Huỷ
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={!name.trim() || !!dateError || mutation.isPending}
            >
              {mutation.isPending ? 'Đang lưu…' : editing ? 'Lưu' : 'Tạo sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
