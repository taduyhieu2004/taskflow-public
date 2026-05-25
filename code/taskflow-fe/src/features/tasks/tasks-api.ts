import { api, unwrap } from '@/lib/api';
import type { ApiResponse, PageResponse } from '@/types/api';
import type {
  CreateLabelRequest,
  CreateTaskRequest,
  Label,
  MoveTaskRequest,
  Task,
  UpdateTaskRequest,
} from '@/types/task';

export interface TaskFilter {
  project_id?: number;
  board_id?: number;
  list_id?: number;
  sprint_id?: number;
  assignee_id?: number;
  priority?: string;
  q?: string;
  page?: number;
  size?: number;
}

export const tasksApi = {
  list: (filter: TaskFilter) =>
    api
      .get<ApiResponse<PageResponse<Task>>>('/tasks', { params: filter })
      .then(unwrap),

  get: (id: number) => api.get<ApiResponse<Task>>(`/tasks/${id}`).then(unwrap),

  create: (req: CreateTaskRequest) =>
    api.post<ApiResponse<Task>>('/tasks', req).then(unwrap),

  update: (id: number, req: UpdateTaskRequest) =>
    api.put<ApiResponse<Task>>(`/tasks/${id}`, req).then(unwrap),

  remove: (id: number) =>
    api.delete<ApiResponse<void>>(`/tasks/${id}`).then(unwrap),

  move: (id: number, req: MoveTaskRequest) =>
    api.post<ApiResponse<Task>>(`/tasks/${id}/move`, req).then(unwrap),
};

export const labelsApi = {
  list: (projectId: number) =>
    api
      .get<ApiResponse<Label[]>>('/labels', { params: { project_id: projectId } })
      .then(unwrap),

  create: (req: CreateLabelRequest) =>
    api
      .post<ApiResponse<Label>>(
        '/labels',
        { name: req.name, color: req.color },
        { params: { project_id: req.project_id } },
      )
      .then(unwrap),

  update: (id: number, req: { name: string; color: string }) =>
    api.put<ApiResponse<Label>>(`/labels/${id}`, req).then(unwrap),

  remove: (id: number) =>
    api.delete<ApiResponse<void>>(`/labels/${id}`).then(unwrap),
};
