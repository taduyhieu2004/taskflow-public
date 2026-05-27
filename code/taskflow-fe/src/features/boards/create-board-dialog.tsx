import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { projectsApi } from '@/features/projects/projects-api';
import { extractErrorMessage } from '@/lib/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  onSuccess: (boardId: number) => void;
}

export function CreateBoardDialog({ open, onOpenChange, projectId, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const mutation = useMutation({
    mutationFn: async (req: { name: string; description?: string }) => {
      const newBoard = await projectsApi.createBoard(projectId, req);
      try {
        await projectsApi.createList(newBoard.id, { name: 'To Do', position: 0 });
        await projectsApi.createList(newBoard.id, { name: 'In Progress', position: 1 });
        await projectsApi.createList(newBoard.id, { name: 'Done', position: 2 });
      } catch (err) {
        console.error('Failed to initialize default columns:', err);
      }
      return newBoard;
    },
    onSuccess: (newBoard) => {
      queryClient.invalidateQueries({ queryKey: ['boards', projectId] });
      reset();
      onOpenChange(false);
      onSuccess(newBoard.id);
    },
  });

  function reset() {
    setName('');
    setDescription('');
    mutation.reset();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    mutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md bg-white border border-gray-100 rounded-2xl shadow-2xl p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold text-gray-900">Tạo bảng Kanban mới</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">Tạo thêm bảng Kanban cho dự án này.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="board-name" className="text-xs font-semibold text-gray-700">Tên bảng</Label>
            <Input
              id="board-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={255}
              placeholder="Ví dụ: Sprint 2 Board"
              autoFocus
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="board-desc" className="text-xs font-semibold text-gray-700">Mô tả (tuỳ chọn)</Label>
            <textarea
              id="board-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Bảng này dùng để làm gì?"
            />
          </div>

          {mutation.isError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {extractErrorMessage(mutation.error)}
            </div>
          )}

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="sm" className="rounded-lg">
                Huỷ
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo…' : 'Tạo bảng'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
