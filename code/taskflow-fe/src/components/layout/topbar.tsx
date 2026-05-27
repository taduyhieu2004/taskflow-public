import { LogOut, Search, SquareKanban, UserCog } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ProfileDialog } from '@/features/auth/profile-dialog';
import { useLogout } from '@/features/auth/use-logout';
import { NotificationsDropdown } from '@/features/notifications/notifications-dropdown';
import { resolveAvatarUrl } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-30 h-14">
      <div className="h-full px-4 flex items-center justify-between gap-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-md flex items-center justify-center">
            <SquareKanban className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">TaskFlow</span>
        </Link>

        <div className="flex-1 max-w-md mx-auto">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              placeholder="Tìm project, task, member..."
              className="w-full pl-9 pr-4 py-2 bg-gray-100 border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <NotificationsDropdown />

          <Popover>
            <PopoverTrigger asChild>
              <button
                className="flex items-center gap-2 p-1 hover:bg-gray-100 rounded-lg"
                title={user?.username}
              >
                <Avatar
                  name={user?.full_name ?? user?.username}
                  src={resolveAvatarUrl(user?.avatar_url)}
                  seed={user?.id}
                  size="md"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-60 p-0 overflow-hidden" align="end">
              <div className="px-3 py-3 bg-gradient-to-br from-primary-50 to-blue-50 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    name={user?.full_name ?? user?.username}
                    src={resolveAvatarUrl(user?.avatar_url)}
                    seed={user?.id}
                    size="md"
                    ringClass="ring-2 ring-white"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {user?.full_name ?? user?.username}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                  </div>
                </div>
              </div>
              <div className="py-1">
                <button
                  onClick={() => setProfileOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <UserCog className="w-4 h-4 text-gray-400" /> Hồ sơ cá nhân
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                >
                  <LogOut className="w-4 h-4" /> Đăng xuất
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  );
}
