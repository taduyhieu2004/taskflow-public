import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { projectsApi } from '@/features/projects/projects-api';

/**
 * Trả về Set<list_id> của các "Done list" (= list cuối cùng theo position) trong
 * các board được hỏi. Dùng để phân biệt task đã hoàn thành dựa vào convention
 * Kanban: kéo task sang cột cuối = đã xong.
 *
 * `taskIsDone = doneListIds.has(task.list_id)`
 */
export function useDoneListIds(boardIds: Array<number | null | undefined>): Set<number> {
  const uniqueIds = useMemo(
    () => Array.from(new Set(boardIds.filter((id): id is number => !!id))),
    [boardIds],
  );

  const queries = useQueries({
    queries: uniqueIds.map((id) => ({
      queryKey: ['board', id],
      queryFn: () => projectsApi.board(id),
      staleTime: 5 * 60_000,
    })),
  });

  return useMemo(() => {
    const set = new Set<number>();
    queries.forEach((q) => {
      const lists = q.data?.lists ?? [];
      if (lists.length === 0) return;
      const sorted = [...lists].sort((a, b) => a.position - b.position);
      const last = sorted[sorted.length - 1];
      if (last) set.add(last.id);
    });
    return set;
  }, [queries]);
}
