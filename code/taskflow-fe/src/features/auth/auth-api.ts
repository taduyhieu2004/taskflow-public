import { api, unwrap } from '@/lib/api';
import type {
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ResetPasswordRequest,
  User,
} from '@/types/auth';
import type { ApiResponse } from '@/types/api';

export const authApi = {
  login: (req: LoginRequest) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', req).then(unwrap),

  register: (req: RegisterRequest) =>
    api.post<ApiResponse<User>>('/auth/register', req).then(unwrap),

  forgotPassword: (req: ForgotPasswordRequest) =>
    api.post<ApiResponse<{ reset_token?: string }>>('/auth/forgot-password', req).then(unwrap),

  resetPassword: (req: ResetPasswordRequest) =>
    api.post<ApiResponse<void>>('/auth/reset-password', req).then(unwrap),

  logout: () => api.post<ApiResponse<void>>('/auth/logout').then(unwrap),

  me: () => api.get<ApiResponse<User>>('/users/me').then(unwrap),

  updateMe: (req: { full_name?: string; avatar_url?: string; bio?: string; dob?: string }) =>
    api.put<ApiResponse<User>>('/users/me', req).then(unwrap),

  changePassword: (req: { old_password: string; new_password: string }) =>
    api.post<ApiResponse<void>>('/auth/change-password', req).then(unwrap),

  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ApiResponse<User>>('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(unwrap);
  },

  searchUsers: (q: string) =>
    api.get<ApiResponse<{ content: User[] }>>('/users', { params: { q } }).then(unwrap),

  getUser: (id: number) =>
    api.get<ApiResponse<User>>(`/users/${id}`).then(unwrap),
};
