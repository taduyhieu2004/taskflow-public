import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Paperclip, Trash2 } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { attachmentsApi } from '@/features/attachments/attachments-api';
import { extractErrorMessage } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

interface Props {
  taskId: number;
  userMap?: Map<number, { full_name?: string | null; username?: string }>;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function displayName(
  userId: number,
  userMap?: Map<number, { full_name?: string | null; username?: string }>,
): string {
  const u = userMap?.get(userId);
  return u?.full_name ?? u?.username ?? `Người dùng #${userId}`;
}

export function AttachmentsSection({ taskId, userMap }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const me = useAuthStore((s) => s.user);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ['attachments', taskId],
    queryFn: () => attachmentsApi.list(taskId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(taskId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', taskId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => attachmentsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attachments', taskId] }),
  });

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) uploadMutation.mutate(f);
    e.target.value = '';
  }

  return (
    <div className="p-5 bg-gray-50 min-h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <Paperclip className="w-4 h-4" /> File đính kèm{' '}
          <span className="text-xs text-gray-500 font-normal">{attachments.length}</span>
        </h3>
        <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          {uploadMutation.isPending ? 'Đang tải lên…' : 'Tải lên'}
        </Button>
      </div>

      {uploadMutation.isError && (
        <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded p-2 mb-3">
          {extractErrorMessage(uploadMutation.error)}
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-gray-400">Đang tải…</p>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Chưa có file đính kèm nào.</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{a.file_name}</div>
                <div className="text-xs text-gray-500">
                  {formatBytes(a.size_bytes)} · {formatRelativeTime(a.created_at)} · {displayName(a.uploader_id, userMap)}
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    const { blob, fileName } = await attachmentsApi.download(a.id, a.file_name);
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    console.error('Download failed', e);
                  }
                }}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                title="Tải xuống"
              >
                <Download className="w-4 h-4" />
              </button>
              {a.uploader_id === me?.id && (
                <button
                  onClick={() => deleteMutation.mutate(a.id)}
                  className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded opacity-0 group-hover:opacity-100"
                  title="Xoá"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
