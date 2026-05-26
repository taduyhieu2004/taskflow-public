import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { tasksApi } from '@/features/tasks/tasks-api';
import { extractErrorMessage } from '@/lib/api';

interface Props {
  listId: number;
  boardId: number;
  onClose: () => void;
}

export function QuickCreateTask({ listId, boardId, onClose }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const mutation = useMutation({
    mutationFn: tasksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'board', boardId] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      setTitle('');
      onClose();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    mutation.mutate({ list_id: listId, title: title.trim() });
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg p-3 shadow-sm border border-primary-300 ring-2 ring-primary-100 mx-2 mb-2">
      <textarea
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit(e as unknown as FormEvent);
          }
          if (e.key === 'Escape') onClose();
        }}
        placeholder="Nhập tiêu đề task… (Enter để lưu)"
        rows={2}
        className="w-full text-sm border-0 outline-none resize-none placeholder:text-gray-400"
      />
      {mutation.isError && (
        <div className="text-xs text-rose-600 mb-1">{extractErrorMessage(mutation.error)}</div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <Button type="submit" size="sm" disabled={!title.trim() || mutation.isPending}>
          {mutation.isPending ? 'Đang tạo…' : 'Tạo'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
