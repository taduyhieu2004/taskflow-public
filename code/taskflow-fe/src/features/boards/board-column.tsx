import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';
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
  const { setNodeRef, isOver } = useDroppable({
    id: `list-${list.id}`,
    data: { type: 'column', listId: list.id },
  });
  const [collapsed, setCollapsed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDeleteClick() {
    if (confirmDelete) {
      onDelete?.();
      setShowMenu(false);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  }

  function handleCloseMenu() {
    setShowMenu(false);
    setConfirmDelete(false);
  }

  return (
    <div className="w-72 bg-gray-100 rounded-xl flex flex-col flex-shrink-0 max-h-full">
      <div className="p-3 flex items-center justify-between relative">
        <button
          className="flex items-center gap-2 hover:bg-white/50 rounded px-1 -mx-1"
          onClick={() => setCollapsed((v) => !v)}
        >
          <span className={cn('w-2 h-2 rounded-full', dotFor(list.name))} />
          <h3 className="font-semibold text-gray-900 text-sm">{list.name}</h3>
          <span className="text-xs text-gray-500">{tasks.length}</span>
        </button>
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
                    onClick={handleDeleteClick}
                    className={cn(
                      "w-full text-left px-3 py-1.5 text-xs font-medium transition",
                      confirmDelete 
                        ? "bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded" 
                        : "text-rose-600 hover:bg-rose-50"
                    )}
                  >
                    {confirmDelete ? "⚠️ Xác nhận xóa?" : "Xóa cột này"}
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
            ref={setNodeRef}
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
    </div>
  );
}
