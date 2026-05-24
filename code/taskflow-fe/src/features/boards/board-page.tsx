import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Filter, Plus, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '@/components/ui/avatar';
import { BoardColumn } from '@/features/boards/board-column';
import { TaskCard } from '@/features/boards/task-card';
import { authApi } from '@/features/auth/auth-api';
import { InviteMemberDialog } from '@/features/members/invite-member-dialog';
import { projectsApi } from '@/features/projects/projects-api';
import { labelsApi, tasksApi } from '@/features/tasks/tasks-api';
import { CreateTaskDialog } from '@/features/tasks/create-task-dialog';
import { TaskDetailPanel } from '@/features/tasks/task-detail-panel';
import { extractErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { BoardList } from '@/types/project';
import type { Task } from '@/types/task';

export function BoardPage() {
  const { projectId: projectIdParam } = useParams();
  const projectId = Number(projectIdParam);
  const queryClient = useQueryClient();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [creatingInList, setCreatingInList] = useState<number | null>(null);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch project members
  const { data: members = [] } = useQuery({
    queryKey: ['members', projectId],
    queryFn: () => projectsApi.members(projectId),
    enabled: !!projectId,
  });

  // Fetch member profiles
  const userQueries = useQueries({
    queries: members.slice(0, 5).map((m) => ({
      queryKey: ['user', m.user_id],
      queryFn: () => authApi.getUser(m.user_id),
      staleTime: 5 * 60_000,
    })),
  });

  const userMap = useMemo(() => {
    const map = new Map<number, import('@/types/auth').User>();
    userQueries.forEach((q) => {
      if (q.data) map.set(q.data.id, q.data);
    });
    return map;
  }, [userQueries]);

  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId,
  });

  const boardsQuery = useQuery({
    queryKey: ['boards', projectId],
    queryFn: () => projectsApi.boards(projectId),
    enabled: !!projectId,
  });

  const boardIdFromList = boardsQuery.data?.[0]?.id ?? null;

  const boardDetailQuery = useQuery({
    queryKey: ['board', boardIdFromList],
    queryFn: () => projectsApi.board(boardIdFromList!),
    enabled: !!boardIdFromList,
  });

  const board = boardDetailQuery.data ?? null;
  const boardId = board?.id ?? boardIdFromList;

  const tasksQuery = useQuery({
    queryKey: ['tasks', 'board', boardId, searchQuery, filterPriority, filterAssignee],
    queryFn: () =>
      tasksApi.list({
        project_id: projectId,
        board_id: boardId!,
        size: 200,
        q: searchQuery.trim() || undefined,
        priority: filterPriority || undefined,
        assignee_id: filterAssignee || undefined,
      }),
    enabled: !!boardId && !!projectId,
  });

  const labelsQuery = useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => labelsApi.list(projectId),
    enabled: !!projectId,
  });

  const addColumnMutation = useMutation({
    mutationFn: (name: string) =>
      projectsApi.createList(boardId!, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
      setAddingColumn(false);
      setNewColumnName('');
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (listId: number) => projectsApi.deleteList(listId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board', boardId] });
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, toListId, position }: { id: number; toListId: number; position?: number }) =>
      tasksApi.move(id, { to_list_id: toListId, position }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'board', boardId] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasks = tasksQuery.data?.content ?? [];

  const tasksByList = useMemo(() => {
    const map = new Map<number, Task[]>();
    tasks.forEach((t) => {
      const list = map.get(t.list_id) ?? [];
      list.push(t);
      map.set(t.list_id, list);
    });
    // Sort tasks in each list by position
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [tasks]);

  function onDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = tasks.find((t) => t.id === Number(active.id)) ?? null;
    setActiveTask(task);
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || !boardId) return;

    const draggedTask = tasks.find((t) => t.id === Number(active.id));
    if (!draggedTask) return;

    let toListId: number | null = null;
    let position: number | undefined = undefined;

    if (over.data.current?.type === 'Column') {
      toListId = Number(over.id);
      const listTasks = tasksByList.get(toListId) ?? [];
      position = listTasks.length;
    } else if (over.data.current?.type === 'Task') {
      const overTask = tasks.find((t) => t.id === Number(over.id));
      if (overTask) {
        toListId = overTask.list_id;
        position = overTask.position;
      }
    }

    if (toListId === null) return;

    if (draggedTask.list_id === toListId && draggedTask.position === position) return;

    // Optimistic update
    queryClient.setQueryData<import('@/types/api').PageResponse<Task>>(
      ['tasks', 'board', boardId, searchQuery, filterPriority, filterAssignee],
      (old) => {
        if (!old) return old;
        const updated = old.content.map((t) =>
          t.id === draggedTask.id ? { ...t, list_id: toListId!, position: position ?? 0 } : t,
        );
        return { ...old, content: updated };
      },
    );

    moveMutation.mutate({ id: draggedTask.id, toListId, position });
  }

  function handleAddColumn() {
    const trimmed = newColumnName.trim();
    if (!trimmed || !boardId) return;
    addColumnMutation.mutate(trimmed);
  }

  const project = projectQuery.data;
  const lists: BoardList[] = (board?.lists ?? []).slice().sort((a, b) => a.position - b.position);
  const labels = labelsQuery.data ?? [];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/dashboard" className="hover:text-gray-700">Projects</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-700">{project?.name ?? '...'}</span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-medium">{board?.name ?? '...'}</span>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{board?.name ?? 'Board'}</h1>
            <button className="p-1 text-gray-400 hover:text-amber-500"><Star className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition',
                filtersOpen ? 'bg-primary-50 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-100',
              )}
            >
              <Filter className="w-4 h-4" /> Lọc
              {(searchQuery || filterPriority || filterAssignee) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
              )}
            </button>
            <div className="flex items-center gap-3">
              {/* Stacked Avatars */}
              <Link 
                to={`/projects/${projectId}/members`}
                className="flex -space-x-1.5 overflow-hidden hover:opacity-80 transition py-0.5"
                title="Quản lý thành viên"
              >
                {members.slice(0, 4).map((m) => {
                  const u = userMap.get(m.user_id);
                  return (
                    <Avatar 
                      key={m.id} 
                      name={u?.full_name ?? u?.username ?? `U${m.user_id}`} 
                      seed={m.user_id} 
                      size="sm" 
                      ringClass="ring-2 ring-white"
                    />
                  );
                })}
                {members.length > 4 && (
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-[10px] font-bold text-gray-600 ring-2 ring-white">
                    +{members.length - 4}
                  </div>
                )}
              </Link>

              {/* Invite Button */}
              <button
                onClick={() => setInviteOpen(true)}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-gray-50 rounded-full border border-dashed border-gray-300 transition flex items-center justify-center"
                title="Mời thành viên mới"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {filtersOpen && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-3.5 flex-shrink-0 transition-all duration-200">
          {/* Search input */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Tìm kiếm task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
            />
          </div>

          {/* Priority dropdown */}
          <div className="min-w-[140px]">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-gray-700 transition"
            >
              <option value="">-- Độ ưu tiên --</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>

          {/* Assignee dropdown */}
          <div className="min-w-[180px]">
            <select
              value={filterAssignee ?? ''}
              onChange={(e) => setFilterAssignee(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-gray-700 transition"
            >
              <option value="">-- Người thực hiện --</option>
              {members.map((m) => {
                const u = userMap.get(m.user_id);
                return (
                  <option key={m.id} value={m.user_id}>
                    {u?.full_name ?? u?.username ?? `User #${m.user_id}`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Clear button */}
          {(searchQuery || filterPriority || filterAssignee) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterPriority('');
                setFilterAssignee(null);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-lg transition"
            >
              Xoá bộ lọc
            </button>
          )}
        </div>
      )}

      {boardsQuery.isError && (
        <div className="m-6 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
          {extractErrorMessage(boardsQuery.error)}
        </div>
      )}

      {board && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 scrollbar-thin">
            <div className="flex gap-4 h-full min-w-max items-start">
              {lists.map((list) => {
                const listTasks = tasksByList.get(list.id) ?? [];
                return (
                  <div key={list.id} className="h-full">
                    <BoardColumn
                      list={list}
                      tasks={listTasks}
                      labels={labels}
                      onTaskClick={(t) => setOpenTaskId(t.id)}
                      onAddTask={() => setCreatingInList(list.id)}
                      onDelete={() => deleteColumnMutation.mutate(list.id)}
                    />
                  </div>
                );
              })}

              {addingColumn ? (
                <div className="w-72 bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex-shrink-0">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Nhập tên cột..."
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddColumn();
                      if (e.key === 'Escape') { setAddingColumn(false); setNewColumnName(''); }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    disabled={addColumnMutation.isPending}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleAddColumn}
                      disabled={!newColumnName.trim() || addColumnMutation.isPending}
                      className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {addColumnMutation.isPending ? 'Đang tạo…' : 'Thêm cột'}
                    </button>
                    <button
                      onClick={() => { setAddingColumn(false); setNewColumnName(''); }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      Huỷ
                    </button>
                  </div>
                  {addColumnMutation.isError && (
                    <p className="text-xs text-rose-600 mt-2">{extractErrorMessage(addColumnMutation.error)}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="w-72 h-32 rounded-xl border-2 border-dashed border-gray-300 hover:border-primary-500 hover:bg-primary-50/30 transition flex items-center justify-center text-gray-500 hover:text-primary-600 font-medium text-sm flex-shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1" /> Thêm cột
                </button>
              )}
            </div>
          </div>

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} labels={labels} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <TaskDetailPanel
        taskId={openTaskId}
        lists={lists}
        projectId={projectId}
        projectKey={project?.key}
        onClose={() => setOpenTaskId(null)}
      />

      {creatingInList !== null && boardId && (
        <CreateTaskDialog
          listId={creatingInList}
          boardId={boardId}
          projectId={projectId}
          onClose={() => setCreatingInList(null)}
        />
      )}

      {inviteOpen && (
        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          projectId={projectId}
        />
      )}
    </div>
  );
}
