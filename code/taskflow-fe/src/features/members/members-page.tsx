import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Trash2, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { authApi } from '@/features/auth/auth-api';
import { InviteMemberDialog } from '@/features/members/invite-member-dialog';
import { projectsApi } from '@/features/projects/projects-api';
import { extractErrorMessage } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { Role } from '@/types/project';

const ROLES: Role[] = ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER', 'VIEWER'];

const ROLE_BADGE: Record<Role, string> = {
  OWNER: 'bg-primary-50 text-primary-700',
  ADMIN: 'bg-violet-50 text-violet-700',
  EDITOR: 'bg-emerald-50 text-emerald-700',
  COMMENTER: 'bg-sky-50 text-sky-700',
  VIEWER: 'bg-gray-100 text-gray-700',
};

export function MembersPage() {
  const { projectId: param } = useParams();
  const projectId = Number(param);
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  });

  const { data: members = [], isLoading } = useQuery({
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

  const changeRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Role }) =>
      projectsApi.changeRole(projectId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', projectId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: number) => projectsApi.removeMember(projectId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', projectId] }),
  });

  const myRole = project?.my_role;
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/dashboard" className="hover:text-gray-700">Projects</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        {project && (
          <>
            <Link to={`/projects/${projectId}`} className="hover:text-gray-700">{project.name}</Link>
            <ChevronRight className="w-3.5 h-3.5" />
          </>
        )}
        <span className="text-gray-900 font-medium">Members</span>
      </div>

      <div className="flex items-end justify-between mt-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6" /> Thành viên
          </h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} thành viên trong project này</p>
        </div>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4" /> Mời thành viên
          </Button>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">Đang tải…</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Chưa có thành viên nào.</p>
          </div>
        ) : (
          members.map((m) => {
            const u = userMap.get(m.user_id);
            const isSelf = m.user_id === me?.id;
            const isOwner = m.role === 'OWNER';
            return (
              <div key={m.id} className="p-4 flex items-center gap-3">
                <Avatar name={u?.full_name ?? u?.username ?? `U${m.user_id}`} seed={m.user_id} size="lg" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {u?.full_name ?? u?.username ?? `Người dùng #${m.user_id}`}
                    {isSelf && <span className="text-xs text-gray-400 ml-2">(bạn)</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {u?.email ?? '—'} · Tham gia {formatRelativeTime(m.joined_at)}
                  </div>
                </div>

                {canManage && !isOwner && !isSelf ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      changeRoleMutation.mutate({ userId: m.user_id, role: e.target.value as Role })
                    }
                    className="px-2.5 py-1 text-xs border border-gray-200 rounded-md bg-white hover:border-gray-300 focus:ring-2 focus:ring-primary-500 outline-none"
                  >
                    {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                ) : (
                  <span className={cn('px-2 py-0.5 text-[11px] rounded font-semibold', ROLE_BADGE[m.role])}>
                    {m.role}
                  </span>
                )}

                {canManage && !isOwner && !isSelf && (
                  <button
                    onClick={() => {
                      if (confirm(`Xoá thành viên "${u?.username ?? m.user_id}" khỏi project?`)) {
                        removeMutation.mutate(m.user_id);
                      }
                    }}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                    title="Xoá"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {(changeRoleMutation.isError || removeMutation.isError) && (
        <div className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {extractErrorMessage(changeRoleMutation.error ?? removeMutation.error)}
        </div>
      )}

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} projectId={projectId} />
    </div>
  );
}
