import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/features/auth/auth-api';
import { projectsApi } from '@/features/projects/projects-api';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/project';

const ROLE_OPTIONS: Role[] = ['ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
}

export function InviteMemberDialog({ open, onOpenChange, projectId }: Props) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [pickedUserId, setPickedUserId] = useState<number | null>(null);
  const [role, setRole] = useState<Role>('EDITOR');

  const { data: usersData, isFetching } = useQuery({
    queryKey: ['users', 'search', q],
    queryFn: () => authApi.searchUsers(q),
    enabled: q.trim().length >= 2,
  });

  const users = usersData?.content ?? [];

  const addMutation = useMutation({
    mutationFn: () => projectsApi.addMember(projectId, pickedUserId!, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      reset();
      onOpenChange(false);
    },
  });

  function reset() {
    setQ('');
    setPickedUserId(null);
    setRole('EDITOR');
    addMutation.reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mời thành viên</DialogTitle>
          <DialogDescription>Tìm theo username hoặc email, chọn vai trò và thêm vào project.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q">Tìm user</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <Input
                id="q"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPickedUserId(null); }}
                className="pl-9"
                placeholder="alice / alice@example.com"
                autoFocus
              />
            </div>
          </div>

          {q.trim().length >= 2 && (
            <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto scrollbar-thin">
              {isFetching ? (
                <p className="p-3 text-xs text-gray-400">Đang tìm…</p>
              ) : users.length === 0 ? (
                <p className="p-3 text-xs text-gray-400">Không tìm thấy user.</p>
              ) : (
                users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setPickedUserId(u.id)}
                    className={cn(
                      'w-full text-left p-3 flex items-center gap-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-0',
                      pickedUserId === u.id && 'bg-primary-50',
                    )}
                  >
                    <Avatar name={u.full_name ?? u.username} seed={u.id} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{u.full_name ?? u.username}</div>
                      <div className="text-xs text-gray-500">@{u.username} · {u.email}</div>
                    </div>
                    {pickedUserId === u.id && (
                      <span className="text-xs text-primary-600 font-semibold">Đã chọn</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Vai trò</Label>
            <div className="grid grid-cols-2 gap-2">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'px-3 py-2 text-sm border rounded-lg transition text-left',
                    role === r
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-medium'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {addMutation.isError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {extractErrorMessage(addMutation.error)}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Huỷ</Button>
          </DialogClose>
          <Button
            disabled={!pickedUserId || addMutation.isPending}
            onClick={() => addMutation.mutate()}
          >
            <UserPlus className="w-4 h-4" />
            {addMutation.isPending ? 'Đang thêm…' : 'Thêm thành viên'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
