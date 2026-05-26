export interface Comment {
  id: number;
  task_id: number;
  project_id: number;
  author_id: number;
  content: string;
  parent_id?: number | null;
  created_at: number;
  last_updated_at: number;
}

export interface Attachment {
  id: number;
  task_id: number;
  project_id: number;
  uploader_id: number;
  file_name: string;
  mime_type?: string | null;
  size_bytes: number;
  created_at: number;
}

export interface ActivityLog {
  id: number;
  event_id: string;
  project_id: number;
  target_type: string;
  target_id: number;
  action: string;
  actor_id: number;
  /** Tên hiển thị của actor (resolved từ User Service); null nếu hệ thống. */
  actor_name?: string | null;
  /** Câu mô tả tiếng Việt thân thiện, sẵn sàng hiển thị. */
  message?: string | null;
  payload?: Record<string, unknown> | null;
  occurred_at: number;
}

export interface ChecklistItem {
  id: number;
  checklist_id: number;
  content: string;
  completed: boolean;
  position: number;
}

export interface Checklist {
  id: number;
  task_id: number;
  title: string;
  items: ChecklistItem[];
}
