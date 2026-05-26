package com.taskflow.project.service;

import com.taskflow.project.client.TaskServiceClient;
import com.taskflow.project.entity.Board;
import com.taskflow.project.entity.BoardList;
import com.taskflow.project.entity.Sprint;
import com.taskflow.project.repository.BoardListRepository;
import com.taskflow.project.repository.BoardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Chốt số liệu sprint tại 1 thời điểm:
 *   total   = số task gắn sprint
 *   done    = số task đang ở 1 trong các "Done list" của project (list cuối mỗi board)
 *   overdue = số task chưa Done + đã quá hạn
 * Dùng bởi cả {@link SprintService#update} (user đóng tay) và scheduler (auto đóng).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SprintSnapshotService {

    private final BoardRepository boardRepository;
    private final BoardListRepository listRepository;
    private final TaskServiceClient taskClient;

    public void applySnapshot(Sprint sprint) {
        List<Long> doneListIds = findDoneListIds(sprint.getProjectId());
        TaskServiceClient.SprintSnapshot snap = taskClient.sprintSnapshot(sprint.getId(), doneListIds);
        sprint.setClosedAt(System.currentTimeMillis());
        sprint.setClosedTotalTasks(snap.total());
        sprint.setClosedDoneTasks(snap.done());
        sprint.setClosedOverdueTasks(snap.overdue());
        log.info("Sprint {} snapshot: total={} done={} overdue={}",
                sprint.getId(), snap.total(), snap.done(), snap.overdue());
    }

    public void clearSnapshot(Sprint sprint) {
        sprint.setClosedAt(null);
        sprint.setClosedTotalTasks(null);
        sprint.setClosedDoneTasks(null);
        sprint.setClosedOverdueTasks(null);
    }

    private List<Long> findDoneListIds(Long projectId) {
        List<Long> result = new ArrayList<>();
        List<Board> boards = boardRepository.findByProjectIdAndDeletedFalseOrderByPositionAsc(projectId);
        for (Board board : boards) {
            List<BoardList> lists = listRepository
                    .findByBoardIdAndDeletedFalseOrderByPositionAsc(board.getId());
            if (lists.isEmpty()) continue;
            BoardList last = lists.stream()
                    .max(Comparator.comparing(BoardList::getPosition))
                    .orElseThrow();
            result.add(last.getId());
        }
        return result;
    }
}
