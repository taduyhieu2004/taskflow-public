import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck, SquareKanban } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/features/auth/auth-api';
import { extractErrorMessage } from '@/lib/api';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenFromUrl = params.get('token') ?? '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: authApi.resetPassword,
    onSuccess: () => {
      // Delay nhẹ để user thấy thông báo thành công rồi mới chuyển trang
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setClientError(null);

    if (!token.trim()) {
      setClientError('Thiếu token đặt lại mật khẩu. Hãy mở lại link từ email.');
      return;
    }
    if (newPassword.length < 6) {
      setClientError('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirm) {
      setClientError('Mật khẩu nhập lại không khớp.');
      return;
    }

    resetMutation.mutate({ token: token.trim(), new_password: newPassword });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại đăng nhập
        </Link>

        <div className="flex items-center gap-2 mt-4 mb-6">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center">
            <SquareKanban className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">TaskFlow</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary-600" /> Đặt lại mật khẩu
        </h2>
        <p className="text-gray-600 mt-1 text-sm">
          Nhập mật khẩu mới. Link có hiệu lực trong 5 phút từ khi gửi email.
        </p>

        {resetMutation.isSuccess ? (
          <div className="mt-6 space-y-3">
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Đặt lại mật khẩu thành công!</p>
                <p className="mt-0.5">Đang chuyển sang trang đăng nhập…</p>
              </div>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {/* Token (ẩn nếu lấy từ URL — show readonly) */}
            {!tokenFromUrl && (
              <div className="space-y-1.5">
                <Label htmlFor="token">Mã token</Label>
                <Input
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Dán mã token từ email"
                  required
                  className="font-mono text-xs"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="new-password">Mật khẩu mới</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="new-password"
                  type={showPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  aria-label={showPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Nhập lại mật khẩu</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <Input
                  id="confirm-password"
                  type={showPwd ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Nhập lại mật khẩu để xác nhận"
                  className="pl-10"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {(clientError || resetMutation.isError) && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {clientError ?? extractErrorMessage(resetMutation.error)}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? 'Đang xử lý…' : 'Đặt lại mật khẩu'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
