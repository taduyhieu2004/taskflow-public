import { api, unwrap } from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { Sprint, SprintRequest } from '@/types/sprint';

export const sprintsApi = {
  list: (projectId: number) =>
    api.get<ApiResponse<Sprint[]>>(`/projects/${projectId}/sprints`).then(unwrap),

  create: (projectId: number, req: SprintRequest) =>
    api.post<ApiResponse<Sprint>>(`/projects/${projectId}/sprints`, req).then(unwrap),

  update: (sprintId: number, req: SprintRequest) =>
    api.patch<ApiResponse<Sprint>>(`/sprints/${sprintId}`, req).then(unwrap),
};
