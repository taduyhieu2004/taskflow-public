import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, SquareKanban, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/features/auth/auth-api';
import { extractErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      setSession({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: { id: data.id, username: data.username, email: '' },
      });
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/dashboard';
      navigate(from, { replace: true });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    loginMutation.mutate({ username: username.trim(), password });
  }

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-700 p-12 flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
              <SquareKanban className="w-5 h-5 text-primary-600" />
            </div>
            <span className="font-bold text-xl">TaskFlow</span>
          </div>
        </div>

        <div className="relative">
          <h1 className="text-4xl font-bold leading-tight">
            Quản lý dự án<br />đơn giản, hiệu quả.
          </h1>
          <p className="text-white/80 mt-4 leading-relaxed max-w-md">
            Kanban board, task assignment, comment & attachment, thông báo realtime. Đủ để team bạn chạy nhanh hơn.
          </p>

          <div className="mt-10 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-5 max-w-md space-y-2 text-sm text-white/90">
            <Bullet>Drag-drop kéo task giữa các cột</Bullet>
            <Bullet>Thông báo realtime khi có thay đổi</Bullet>
            <Bullet>Phân quyền 5 vai trò chi tiết</Bullet>
          </div>
        </div>

        <div className="relative text-sm text-white/60">© 2026 TaskFlow. Đồ án Microservices.</div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
              <SquareKanban className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">TaskFlow</span>
          </div>

          <h2 className="text-3xl font-bold text-gray-900">Chào mừng trở lại</h2>
          <p className="text-gray-600 mt-2">Đăng nhập để tiếp tục với dự án của bạn.</p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nhập tên đăng nhập"
                  className="pl-10"
                  required
                  autoComplete="username"
                  disabled={loginMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Mật khẩu</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                  disabled={loginMutation.isPending}
                />
                <button
                  type="button"
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {loginMutation.isError && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {extractErrorMessage(loginMutation.error)}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-gray-600">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold">
              Đăng ký ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
      <span>{children}</span>
    </div>
  );
}
