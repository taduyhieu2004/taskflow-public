export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'CLOSED';

export interface Sprint {
  id: number;
  project_id: number;
  name: string;
  goal?: string | null;
  start_date?: number | null;
  end_date?: number | null;
  status: SprintStatus;
  /** Time điểm snapshot khi sprint chuyển sang CLOSED. Null nếu chưa từng đóng. */
  closed_at?: number | null;
  closed_total_tasks?: number | null;
  closed_done_tasks?: number | null;
  closed_overdue_tasks?: number | null;
}

export interface SprintRequest {
  name: string;
  goal?: string;
  start_date?: number | null;
  end_date?: number | null;
  status?: SprintStatus;
}
