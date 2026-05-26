import { useMutation } from '@tanstack/react-query';
import { Lock, Mail, SquareKanban, User } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/features/auth/auth-api';
import { extractErrorMessage } from '@/lib/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => navigate('/login', { replace: true }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    registerMutation.mutate({
      username: username.trim(),
      email: email.trim(),
      password,
      full_name: fullName.trim() || undefined,
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <SquareKanban className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">TaskFlow</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900">Tạo tài khoản mới</h2>
        <p className="text-gray-600 mt-1 text-sm">Bắt đầu quản lý dự án của bạn ngay.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Field icon={<User className="w-5 h-5" />} label="Tên đăng nhập" htmlFor="username">
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nhập tên đăng nhập (tối thiểu 3 ký tự)"
              className="pl-10"
              required
              minLength={3}
              autoComplete="username"
            />
          </Field>

          <Field icon={<Mail className="w-5 h-5" />} label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Nhập địa chỉ email"
              className="pl-10"
              required
              autoComplete="email"
            />
          </Field>

          <Field icon={<User className="w-5 h-5" />} label="Họ tên (tuỳ chọn)" htmlFor="fullName">
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên hiển thị"
              className="pl-10"
              autoComplete="name"
            />
          </Field>

          <Field icon={<Lock className="w-5 h-5" />} label="Mật khẩu" htmlFor="password">
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu (tối thiểu 6 ký tự)"
              className="pl-10"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </Field>

          {registerMutation.isError && (
            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {extractErrorMessage(registerMutation.error)}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Đang tạo…' : 'Đăng ký'}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  htmlFor,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-3 text-gray-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}
