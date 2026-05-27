import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, Camera, Hash, KeyRound, Mail, UserCog } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { authApi } from '@/features/auth/auth-api';
import { notificationsApi } from '@/features/notifications/notifications-api';
import { extractErrorMessage, resolveAvatarUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import type { UpdatePreferenceRequest } from '@/types/notification';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'profile' | 'password' | 'notification';

export function ProfileDialog({ open, onOpenChange }: Props) {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('profile');

  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarLocalPreview, setAvatarLocalPreview] = useState<string | null>(null);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);

  useEffect(() => {
    if (open && user) {
      setFullName(user.full_name ?? '');
      setBio(user.bio ?? '');
      setDob(user.dob ?? '');
      setAvatarLocalPreview(null);
      setTab('profile');
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setPwdSuccess(false);
    }
  }, [open, user]);

  useEffect(() => {
    return () => {
      if (avatarLocalPreview) URL.revokeObjectURL(avatarLocalPreview);
    };
  }, [avatarLocalPreview]);

  const profileMutation = useMutation({
    mutationFn: () =>
      authApi.updateMe({
        full_name: fullName.trim() || undefined,
        bio: bio.trim() || undefined,
        dob: dob || undefined,
      }),
    onSuccess: (updated) => {
      updateUser(updated);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: (updated) => {
      updateUser(updated);
      if (avatarLocalPreview) {
        URL.revokeObjectURL(avatarLocalPreview);
        setAvatarLocalPreview(null);
      }
    },
  });

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      avatarMutation.reset();
      return;
    }
    if (avatarLocalPreview) URL.revokeObjectURL(avatarLocalPreview);
    setAvatarLocalPreview(URL.createObjectURL(file));
    avatarMutation.mutate(file);
  }

  const passwordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({ old_password: oldPwd, new_password: newPwd }),
    onSuccess: () => {
      setPwdSuccess(true);
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    },
  });

  const pwdMismatch = newPwd.length > 0 && confirmPwd.length > 0 && newPwd !== confirmPwd;
  const pwdTooShort = newPwd.length > 0 && newPwd.length < 6;
  const canSubmitPwd =
    oldPwd.length > 0 && newPwd.length >= 6 && newPwd === confirmPwd && !passwordMutation.isPending;

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    profileMutation.mutate();
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmitPwd) return;
    passwordMutation.mutate();
  }

  const prefQuery = useQuery({
    queryKey: ['notifications', 'preference'],
    queryFn: notificationsApi.preference,
    enabled: open && tab === 'notification',
  });

  const prefMutation = useMutation({
    mutationFn: (req: UpdatePreferenceRequest) => notificationsApi.updatePreference(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'preference'] });
    },
  });

  const handleToggleInApp = (checked: boolean) => {
    prefMutation.mutate({ in_app_enabled: checked });
  };

  const handleToggleEmail = (checked: boolean) => {
    prefMutation.mutate({ email_enabled: checked });
  };

  const handleToggleType = (type: string, checked: boolean) => {
    const currentSettings = prefQuery.data?.per_type_settings ?? {};
    prefMutation.mutate({
      per_type_settings: {
        ...currentSettings,
        [type]: checked,
      },
    });
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary-600" /> Hồ sơ cá nhân
          </DialogTitle>
          <DialogDescription>Xem và cập nhật thông tin tài khoản của bạn.</DialogDescription>
        </DialogHeader>

        {/* Identity card */}
        <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-100 rounded-xl p-4 flex items-center gap-3">
          <div className="relative">
            <Avatar
              name={user.full_name ?? user.username}
              src={avatarLocalPreview ?? resolveAvatarUrl(user.avatar_url)}
              seed={user.id}
              size="lg"
              ringClass="ring-2 ring-white"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              className={cn(
                'absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-300 shadow text-gray-600',
                'flex items-center justify-center hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 transition',
                avatarMutation.isPending && 'opacity-50 cursor-wait',
              )}
              title="Đổi ảnh đại diện"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              hidden
              onChange={handleAvatarChange}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">
              {user.full_name ?? user.username}
            </div>
            <div className="text-xs text-gray-600 truncate inline-flex items-center gap-1">
              <Mail className="w-3 h-3" /> {user.email}
            </div>
            <div className="text-xs text-gray-500 truncate inline-flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1">
                <Hash className="w-3 h-3" /> {user.username}
              </span>
              {user.status && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-white/70 rounded text-gray-700 uppercase">
                  {user.status}
                </span>
              )}
            </div>
            {avatarMutation.isPending && (
              <div className="text-[11px] text-primary-700 mt-1">Đang tải ảnh lên…</div>
            )}
            {avatarMutation.isError && (
              <div className="text-[11px] text-rose-600 mt-1">
                {extractErrorMessage(avatarMutation.error)}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 flex gap-3 -mb-px">
          <TabBtn active={tab === 'profile'} onClick={() => setTab('profile')}>
            Thông tin
          </TabBtn>
          <TabBtn active={tab === 'password'} onClick={() => setTab('password')}>
            Đổi mật khẩu
          </TabBtn>
          <TabBtn active={tab === 'notification'} onClick={() => setTab('notification')}>
            Nhận thông báo
          </TabBtn>
        </div>

        {tab === 'profile' ? (
          <form onSubmit={handleProfileSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">Họ tên đầy đủ</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={255}
                placeholder="VD: Tạ Duy Hiếu"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Ngày sinh
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Giới thiệu</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Vài dòng giới thiệu bản thân…"
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <div className="text-[10px] text-gray-400 text-right mt-0.5">{bio.length}/1000</div>
            </div>

            {profileMutation.isError && (
              <p className="text-xs text-rose-600">{extractErrorMessage(profileMutation.error)}</p>
            )}
            {profileMutation.isSuccess && (
              <p className="text-xs text-emerald-600 font-medium">Đã cập nhật hồ sơ.</p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="sm">
                  Đóng
                </Button>
              </DialogClose>
              <Button type="submit" size="sm" disabled={profileMutation.isPending}>
                {profileMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        ) : tab === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 inline-flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> Mật khẩu hiện tại
              </label>
              <input
                type="password"
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Mật khẩu mới</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className={cn(
                  'mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500',
                  pwdTooShort ? 'border-rose-300' : 'border-gray-300',
                )}
              />
              {pwdTooShort && (
                <p className="text-[11px] text-rose-600 mt-1">Tối thiểu 6 ký tự.</p>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                className={cn(
                  'mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500',
                  pwdMismatch ? 'border-rose-300' : 'border-gray-300',
                )}
              />
              {pwdMismatch && (
                <p className="text-[11px] text-rose-600 mt-1">Mật khẩu xác nhận không khớp.</p>
              )}
            </div>

            {passwordMutation.isError && (
              <p className="text-xs text-rose-600">{extractErrorMessage(passwordMutation.error)}</p>
            )}
            {pwdSuccess && (
              <p className="text-xs text-emerald-600 font-medium">Đã đổi mật khẩu thành công.</p>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="sm">
                  Đóng
                </Button>
              </DialogClose>
              <Button type="submit" size="sm" disabled={!canSubmitPwd}>
                {passwordMutation.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            {prefQuery.isLoading ? (
              <p className="text-xs text-gray-400 py-6 text-center font-sans">Đang tải cấu hình…</p>
            ) : prefQuery.isError ? (
              <p className="text-xs text-rose-600 py-6 text-center font-sans">Không thể tải cấu hình thông báo.</p>
            ) : (
              <div className="space-y-5">
                {/* Global switches */}
                <div className="space-y-3 bg-gray-50 p-3.5 rounded-xl border border-gray-100 font-sans">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kênh nhận thông báo</p>
                  
                  <label className="flex items-center justify-between cursor-pointer group py-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Thông báo trong ứng dụng</p>
                      <p className="text-xs text-gray-500">Hiển thị quả chuông và thông báo nổi</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefQuery.data?.in_app_enabled ?? true}
                      onChange={(e) => handleToggleInApp(e.target.checked)}
                      disabled={prefMutation.isPending}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group py-1">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Thông báo qua Email</p>
                      <p className="text-xs text-gray-500">Gửi cập nhật hoạt động đến hòm thư điện tử</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefQuery.data?.email_enabled ?? false}
                      onChange={(e) => handleToggleEmail(e.target.checked)}
                      disabled={prefMutation.isPending}
                      className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Per-type settings */}
                <div className="space-y-3 font-sans">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">Nhận thông báo khi</p>
                  
                  <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <NotificationTypeToggle
                      label="Được giao công việc (Task) mới"
                      description="Có ai đó phân công công việc cho bạn thực hiện"
                      checked={prefQuery.data?.per_type_settings?.TASK_ASSIGNED ?? true}
                      onChange={(checked) => handleToggleType('TASK_ASSIGNED', checked)}
                      disabled={prefMutation.isPending || !(prefQuery.data?.in_app_enabled ?? true)}
                    />
                    <NotificationTypeToggle
                      label="Công việc quá hạn"
                      description="Công việc được giao quá thời gian Deadline mà chưa hoàn thành"
                      checked={prefQuery.data?.per_type_settings?.TASK_OVERDUE ?? true}
                      onChange={(checked) => handleToggleType('TASK_OVERDUE', checked)}
                      disabled={prefMutation.isPending || !(prefQuery.data?.in_app_enabled ?? true)}
                    />
                    <NotificationTypeToggle
                      label="Công việc sắp đến hạn"
                      description="Hệ thống nhắc nhở trước khi hết hạn công việc"
                      checked={prefQuery.data?.per_type_settings?.TASK_DUE_SOON ?? true}
                      onChange={(checked) => handleToggleType('TASK_DUE_SOON', checked)}
                      disabled={prefMutation.isPending || !(prefQuery.data?.in_app_enabled ?? true)}
                    />
                    <NotificationTypeToggle
                      label="Công việc bị xoá"
                      description="Công việc bạn tham gia hoặc theo dõi bị xoá khỏi bảng"
                      checked={prefQuery.data?.per_type_settings?.TASK_DELETED ?? true}
                      onChange={(checked) => handleToggleType('TASK_DELETED', checked)}
                      disabled={prefMutation.isPending || !(prefQuery.data?.in_app_enabled ?? true)}
                    />
                    <NotificationTypeToggle
                      label="Được mời tham gia dự án"
                      description="Có người thêm bạn vào danh sách thành viên của dự án mới"
                      checked={prefQuery.data?.per_type_settings?.MEMBER_INVITED ?? true}
                      onChange={(checked) => handleToggleType('MEMBER_INVITED', checked)}
                      disabled={prefMutation.isPending || !(prefQuery.data?.in_app_enabled ?? true)}
                    />
                  </div>
                </div>

                {prefMutation.isPending && (
                  <p className="text-[10px] text-gray-400 italic text-right font-sans">Đang tự động lưu thay đổi…</p>
                )}
              </div>
            )}

            <DialogFooter className="pt-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary" size="sm" className="rounded-lg font-sans">
                  Đóng
                </Button>
              </DialogClose>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotificationTypeToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start justify-between p-3.5 cursor-pointer select-none transition-colors font-sans",
        disabled ? "opacity-50 cursor-not-allowed bg-gray-50/50" : "hover:bg-gray-50"
      )}
    >
      <div className="flex-1 pr-4 min-w-0">
        <p className="text-sm font-semibold text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 mt-0.5 rounded text-primary-600 focus:ring-primary-500 border-gray-300 cursor-pointer disabled:cursor-not-allowed"
      />
    </label>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-1 pb-2 text-sm font-medium border-b-2 transition',
        active ? 'text-primary-700 border-primary-600' : 'text-gray-500 border-transparent hover:text-gray-700',
      )}
    >
      {children}
    </button>
  );
}
