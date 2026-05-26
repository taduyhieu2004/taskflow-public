import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SendHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { commentsApi } from '@/features/comments/comments-api';
import { extractErrorMessage } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { Comment } from '@/types/collab';

interface Props {
  taskId: number;
  /** Map userId → user info (full_name, username). Truyền từ task-detail-panel. */
  userMap?: Map<number, { full_name?: string | null; username?: string }>;
}

function displayName(
  userId: number,
  userMap?: Map<number, { full_name?: string | null; username?: string }>,
): string {
  const u = userMap?.get(userId);
  return u?.full_name ?? u?.username ?? `Người dùng #${userId}`;
}

export function CommentsSection({ taskId, userMap }: Props) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', taskId],
    queryFn: () => commentsApi.list(taskId),
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => commentsApi.create(taskId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setDraft('');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    createMutation.mutate(draft.trim());
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-5 space-y-4 overflow-y-auto bg-gray-50 scrollbar-thin">
        {isLoading ? (
          <p className="text-xs text-gray-400">Đang tải bình luận…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Chưa có bình luận nào.</p>
        ) : (
          comments.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              taskId={taskId}
              canEdit={c.author_id === me?.id}
              userMap={userMap}
            />
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2.5">
          <Avatar name={me?.full_name ?? me?.username} seed={me?.id} size="md" />
          <form onSubmit={onSubmit} className="flex-1">
            <div className="border border-gray-200 rounded-lg focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    onSubmit(e as unknown as FormEvent);
                  }
                }}
                placeholder="Viết bình luận, dùng @ để mention… (Ctrl+Enter để gửi)"
                rows={2}
                className="w-full p-3 text-sm border-0 rounded-t-lg outline-none resize-none placeholder:text-gray-400"
                disabled={createMutation.isPending}
              />
              <div className="flex items-center justify-between px-2 pb-2">
                {createMutation.isError ? (
                  <span className="text-xs text-rose-600 px-1">
                    {extractErrorMessage(createMutation.error)}
                  </span>
                ) : (
                  <span />
                )}
                <Button type="submit" size="sm" disabled={!draft.trim() || createMutation.isPending}>
                  Gửi <SendHorizontal className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function CommentItem({
  comment,
  taskId,
  canEdit,
  userMap,
}: {
  comment: Comment;
  taskId: number;
  canEdit: boolean;
  userMap?: Map<number, { full_name?: string | null; username?: string }>;
}) {
  const author = displayName(comment.author_id, userMap);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);

  const updateMutation = useMutation({
    mutationFn: (content: string) => commentsApi.update(comment.id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', taskId] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => commentsApi.remove(comment.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['comments', taskId] }),
  });

  return (
    <div className="flex gap-3">
      <Avatar seed={comment.author_id} name={author} size="md" />
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-gray-900">{author}</span>
            <span className="text-gray-400">{formatRelativeTime(comment.created_at)}</span>
            {comment.last_updated_at > comment.created_at + 1000 && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-400">đã sửa</span>
              </>
            )}
          </div>
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                updateMutation.mutate(draft.trim());
              }}
              className="mt-2"
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                className="w-full p-2 text-sm border border-gray-200 rounded focus:ring-2 focus:ring-primary-500 outline-none resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-1.5 mt-1">
                <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                  Huỷ
                </button>
                <button type="submit" className="text-xs bg-primary-600 hover:bg-primary-700 text-white px-2 py-1 rounded">
                  Lưu
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{comment.content}</p>
          )}
        </div>
        {canEdit && !editing && (
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <button onClick={() => setEditing(true)} className="hover:text-gray-700">Sửa</button>
            <button onClick={() => deleteMutation.mutate()} className="hover:text-rose-500">Xoá</button>
          </div>
        )}
      </div>
    </div>
  );
}
