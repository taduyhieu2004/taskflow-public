import { api, unwrap } from '@/lib/api';
import type { ApiResponse } from '@/types/api';
import type { Checklist, ChecklistItem } from '@/types/collab';

export const checklistsApi = {
  list: (taskId: number) =>
    api.get<ApiResponse<Checklist[]>>(`/tasks/${taskId}/checklists`).then(unwrap),

  create: (taskId: number, title: string) =>
    api.post<ApiResponse<Checklist>>(`/tasks/${taskId}/checklists`, { title }).then(unwrap),

  remove: (id: number) =>
    api.delete<ApiResponse<void>>(`/checklists/${id}`).then(unwrap),

  addItem: (checklistId: number, content: string) =>
    api
      .post<ApiResponse<ChecklistItem>>(`/checklists/${checklistId}/items`, { content })
      .then(unwrap),

  toggleItem: (itemId: number, completed: boolean) =>
    api
      .patch<ApiResponse<ChecklistItem>>(`/checklist-items/${itemId}`, { completed })
      .then(unwrap),

  removeItem: (itemId: number) =>
    api.delete<ApiResponse<void>>(`/checklist-items/${itemId}`).then(unwrap),
};
