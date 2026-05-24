import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute, PublicOnlyRoute } from '@/routes/protected-route';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page';
import { DashboardPage } from '@/features/projects/dashboard-page';
import { BoardPage } from '@/features/boards/board-page';
import { NotificationsPage } from '@/features/notifications/notifications-page';
import { MembersPage } from '@/features/members/members-page';
import { MyTasksPage } from '@/features/tasks/my-tasks-page';
import { DueSoonPage } from '@/features/tasks/due-soon-page';

export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/projects', element: <DashboardPage /> },
          { path: '/projects/:projectId', element: <BoardPage /> },
          { path: '/projects/:projectId/members', element: <MembersPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
          { path: '/my-tasks', element: <MyTasksPage /> },
          { path: '/due-soon', element: <DueSoonPage /> },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
