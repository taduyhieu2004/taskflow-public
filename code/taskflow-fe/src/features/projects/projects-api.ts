import { api, unwrap } from '@/lib/api';
import type { ApiResponse, PageResponse } from '@/types/api';
import type {
  Board,
  BoardList,
  CreateProjectRequest,
  Member,
  Project,
  Role,
  UpdateProjectRequest,
} from '@/types/project';

export const projectsApi = {
  list: () => api.get<ApiResponse<Project[]>>('/projects').then(unwrap),

  search: (q: string) =>
    api
      .get<ApiResponse<Project[]>>('/projects/search', { params: { q } })
      .then(unwrap),

  get: (id: number) => api.get<ApiResponse<Project>>(`/projects/${id}`).then(unwrap),

  create: (req: CreateProjectRequest) =>
    api.post<ApiResponse<Project>>('/projects', req).then(unwrap),

  update: (id: number, req: UpdateProjectRequest) =>
    api.put<ApiResponse<Project>>(`/projects/${id}`, req).then(unwrap),

  remove: (id: number) =>
    api.delete<ApiResponse<void>>(`/projects/${id}`).then(unwrap),

  boards: (projectId: number) =>
    api
      .get<ApiResponse<Board[]>>(`/projects/${projectId}/boards`)
      .then(unwrap),

  board: (boardId: number) =>
    api.get<ApiResponse<Board>>(`/boards/${boardId}`).then(unwrap),

  members: (projectId: number) =>
    api
      .get<ApiResponse<PageResponse<Member> | Member[]>>(`/projects/${projectId}/members`)
      .then((res) => {
        const data = res.data.data;
        return Array.isArray(data) ? data : data.content;
      }),

  addMember: (projectId: number, userId: number, role: Role) =>
    api
      .post<ApiResponse<Member>>(`/projects/${projectId}/members`, { user_id: userId, role })
      .then(unwrap),

  removeMember: (projectId: number, userId: number) =>
    api.delete<ApiResponse<void>>(`/projects/${projectId}/members/${userId}`).then(unwrap),

  changeRole: (projectId: number, userId: number, role: Role) =>
    api
      .put<ApiResponse<Member>>(`/projects/${projectId}/members/${userId}/role`, { role })
      .then(unwrap),

  createList: (boardId: number, req: { name: string; description?: string }) =>
    api
      .post<ApiResponse<BoardList>>(`/boards/${boardId}/lists`, req)
      .then(unwrap),

  deleteList: (listId: number) =>
    api.delete<ApiResponse<void>>(`/lists/${listId}`).then(unwrap),
};
