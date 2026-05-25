import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Calendar, Flag } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Label, Priority, Task } from '@/types/task';

const PRIORITY_STYLES: Record<Priority, { color: string; icon: React.ReactNode }> = {
  URGENT: { color: 'text-rose-600', icon: <AlertTriangle className="w-3 h-3" /> },
  HIGH: { color: 'text-amber-600', icon: <Flag className="w-3 h-3" /> },
  MEDIUM: { color: 'text-blue-600', icon: <Flag className="w-3 h-3" /> },
  LOW: { color: 'text-gray-500', icon: <Flag className="w-3 h-3" /> },
};

interface Props {
  task: Task;
  labels: Label[];
  onClick?: () => void;
}

export function TaskCard({ task, labels, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'Task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const taskLabels = (task.label_ids ?? []).map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];

  const overdue = task.due_date != null && task.due_date < Date.now();
  const dueText = task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'bg-white rounded-lg p-3 cursor-pointer transition shadow-sm hover:shadow-md hover:-translate-y-0.5 border border-gray-100',
        isDragging && 'opacity-40 rotate-2 shadow-lg ring-2 ring-primary-500 ring-offset-2 ring-offset-gray-100',
      )}
    >
      {taskLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {taskLabels.map((l) => (
            <span
              key={l.id}
              className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
              style={{ backgroundColor: `${l.color}20`, color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      <h4 className="text-sm font-medium text-gray-900 leading-snug">{task.title}</h4>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {task.priority && (
            <span className={cn('flex items-center gap-1 font-medium', PRIORITY_STYLES[task.priority].color)}>
              {PRIORITY_STYLES[task.priority].icon}
              {task.priority}
            </span>
          )}
          {dueText && (
            <span className={cn('flex items-center gap-1', overdue && 'text-rose-600')}>
              <Calendar className="w-3 h-3" /> {dueText}
            </span>
          )}
        </div>
        {task.assignee_id ? (
          <Avatar seed={task.assignee_id} name={String(task.assignee_id)} size="sm" />
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-[10px]">?</div>
        )}
      </div>
    </div>
  );
}
