import { useQuery } from '@tanstack/react-query';
import { Clock, Folder, LayoutDashboard, LogOut, Plus, UserCheck, UserCog } from 'lucide-react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { ProfileDialog } from '@/features/auth/profile-dialog';
import { CreateProjectDialog } from '@/features/projects/create-project-dialog';
import { projectsApi } from '@/features/projects/projects-api';
import { resolveAvatarUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  });

  return (
    <aside className="w-60 bg-white border-r border-gray-200 fixed left-0 top-14 bottom-0 overflow-y-auto flex flex-col">
      <div className="p-3">
        <button
          onClick={() => setCreateOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Project mới
        </button>
      </div>

      <nav className="px-2 space-y-0.5">
        <NavItem to="/dashboard" icon={<LayoutDashboard className="w-4 h-4" />}>Dashboard</NavItem>
        <NavItem to="/projects" icon={<Folder className="w-4 h-4" />}>Tất cả project</NavItem>
        <NavItem to="/my-tasks" icon={<UserCheck className="w-4 h-4" />}>Task của tôi</NavItem>
        <NavItem to="/due-soon" icon={<Clock className="w-4 h-4" />}>Sắp hết hạn</NavItem>
      </nav>

      <div className="mt-6 px-2 flex-1 overflow-y-auto">
        <div className="px-3 mb-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center justify-between">
          <span>Project</span>
          <button onClick={() => setCreateOpen(true)} className="hover:text-gray-600" title="Tạo project mới">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {projects.map((p) => (
          <NavLink
            key={p.id}
            to={`/projects/${p.id}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg',
                isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-100',
              )
            }
          >
            <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
            <span className="truncate">{p.name}</span>
          </NavLink>
        ))}
        {projects.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-400">Chưa có project nào</div>
        )}
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left hover:bg-gray-50 rounded-lg px-1 -mx-1 py-1 -my-1 transition group"
            title="Xem hồ sơ"
          >
            <Avatar
              name={user?.full_name ?? user?.username}
              src={resolveAvatarUrl(user?.avatar_url)}
              seed={user?.id}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate group-hover:text-primary-700 transition">
                {user?.full_name ?? user?.username}
              </div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
          </button>
          <button
            onClick={() => setProfileOpen(true)}
            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition"
            title="Hồ sơ"
          >
            <UserCog className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
            title="Đăng xuất"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </aside>
  );
}

function NavItem({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition',
          isActive ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-100',
        )
      }
    >
      {icon}
      {children}
    </NavLink>
  );
}
