import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
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
import type { Board } from '@/types/project';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board | null;
}

export function EditBoardDialog({ open, onOpenChange, board }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (board) {
      setName(board.name);
      setDescription(board.description ?? '');
    }
  }, [board, open]);

  const mutation = useMutation({
    mutationFn: (req: { name: string; description?: string }) =>
      projectsApi.updateBoard(board!.id, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards', board!.project_id] });
      queryClient.invalidateQueries({ queryKey: ['board', board!.id] });
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !board) return;
    mutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-white border border-gray-100 rounded-2xl shadow-2xl p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold text-gray-900 font-sans">Chỉnh sửa bảng</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 font-sans">Cập nhật thông tin bảng Kanban.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-board-name" className="text-xs font-semibold text-gray-700 font-sans">Tên bảng</Label>
            <Input
              id="edit-board-name"
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
            <Label htmlFor="edit-board-desc" className="text-xs font-semibold text-gray-700 font-sans">Mô tả (tuỳ chọn)</Label>
            <textarea
              id="edit-board-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none font-sans"
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
            <Button type="submit" size="sm" className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold font-sans" disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
