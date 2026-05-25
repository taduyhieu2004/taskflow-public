import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
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
import { TaskCard } from '@/features/boards/task-card';
import { cn } from '@/lib/utils';
import type { BoardList } from '@/types/project';
import type { Label, Task } from '@/types/task';

const LIST_DOT_COLOR: Record<string, string> = {
  'to do': 'bg-slate-400',
  todo: 'bg-slate-400',
  backlog: 'bg-slate-400',
  'in progress': 'bg-amber-500',
  doing: 'bg-amber-500',
  'in review': 'bg-blue-500',
  review: 'bg-blue-500',
  done: 'bg-emerald-500',
  closed: 'bg-emerald-500',
};

function dotFor(name: string) {
  return LIST_DOT_COLOR[name.toLowerCase()] ?? 'bg-primary-500';
}

interface Props {
  list: BoardList;
  tasks: Task[];
  labels: Label[];
  onTaskClick?: (task: Task) => void;
  onAddTask?: () => void;
  onDelete?: () => void;
}

export function BoardColumn({ list, tasks, labels, onTaskClick, onAddTask, onDelete }: Props) {
  const {
    setNodeRef: setSortableRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `col-${list.id}`,
    data: { type: 'Column', listId: list.id },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `list-${list.id}`,
    data: { type: 'Column', listId: list.id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [collapsed, setCollapsed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleCloseMenu() {
    setShowMenu(false);
  }

  function handleConfirmDelete() {
    onDelete?.();
    setConfirmOpen(false);
    setShowMenu(false);
  }

  const taskCount = tasks.length;
  const hasTasks = taskCount > 0;

  return (
    <div
      ref={setSortableRef}
      style={style}
      className={cn(
        'w-72 bg-gray-100 rounded-xl flex flex-col flex-shrink-0 max-h-full',
        isDragging && 'opacity-40 ring-2 ring-primary-400 ring-offset-2 ring-offset-gray-50',
      )}
    >
      <div className="p-3 flex items-center justify-between relative">
        <div className="flex items-center gap-1 min-w-0">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 text-gray-300 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
            title="Kéo để đổi thứ tự cột"
            aria-label="Kéo cột"
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <button
            className="flex items-center gap-2 hover:bg-white/50 rounded px-1 min-w-0"
            onClick={() => setCollapsed((v) => !v)}
          >
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotFor(list.name))} />
            <h3 className="font-semibold text-gray-900 text-sm truncate">{list.name}</h3>
            <span className="text-xs text-gray-500 flex-shrink-0">{tasks.length}</span>
          </button>
        </div>
        <div className="flex items-center">
          <button onClick={onAddTask} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-white rounded">
            <Plus className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu((m) => !m)}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-white rounded"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={handleCloseMenu} />
                <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setConfirmOpen(true);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition inline-flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Xoá cột này
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          <div
            ref={setDropRef}
            className={cn(
              'flex-1 overflow-y-auto px-2 pb-2 space-y-2 min-h-[40px] scrollbar-thin transition',
              isOver && 'bg-primary-50/60 ring-2 ring-dashed ring-primary-400',
            )}
          >
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} labels={labels} onClick={() => onTaskClick?.(task)} />
              ))}
            </SortableContext>
            {tasks.length === 0 && (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-3 flex items-center justify-center text-gray-400 text-xs">
                Kéo task vào đây
              </div>
            )}
          </div>
          <button
            onClick={onAddTask}
            className="m-2 px-3 py-2 text-sm text-gray-600 hover:bg-white rounded-lg flex items-center gap-1.5 justify-center transition"
          >
            <Plus className="w-4 h-4" /> Thêm task
          </button>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center',
                  hasTasks ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-600',
                )}
              >
                <AlertTriangle className="w-5 h-5" />
              </span>
              Xoá cột "{list.name}"?
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-gray-700 space-y-2 pt-2">
                {hasTasks ? (
                  <>
                    <p>
                      Cột này đang có{' '}
                      <span className="font-bold text-rose-600">{taskCount} task</span>. Khi xoá
                      cột, <span className="font-semibold">toàn bộ task bên trong sẽ bị xoá theo</span>{' '}
                      (cùng với comment, attachment, checklist của các task đó).
                    </p>
                    <p className="text-xs text-gray-500">
                      Nếu muốn giữ task lại, hãy kéo chúng sang cột khác trước rồi mới xoá.
                    </p>
                  </>
                ) : (
                  <p>Cột đang rỗng — không có task nào bị ảnh hưởng. Bạn có chắc?</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="sm">
                Huỷ
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleConfirmDelete}
            >
              {hasTasks ? `Xoá cột & ${taskCount} task` : 'Xoá cột'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
