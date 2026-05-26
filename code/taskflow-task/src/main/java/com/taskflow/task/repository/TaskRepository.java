package com.taskflow.task.repository;

import com.taskflow.task.entity.Task;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    Optional<Task> findByIdAndDeletedFalse(Long id);

    int countByListIdAndDeletedFalse(Long listId);

    @Query("""
        SELECT t FROM Task t
        WHERE t.deleted = false
          AND (:projectId IS NULL OR t.projectId = :projectId)
          AND (:boardId IS NULL OR t.boardId = :boardId)
          AND (:listId IS NULL OR t.listId = :listId)
          AND (:sprintId IS NULL OR t.sprintId = :sprintId)
          AND (:assigneeId IS NULL OR t.assigneeId = :assigneeId)
          AND (:priority IS NULL OR t.priority = :priority)
          AND (:q = '' OR LOWER(t.title) LIKE LOWER(CONCAT('%', :q, '%'))
                       OR LOWER(t.description) LIKE LOWER(CONCAT('%', :q, '%')))
        """)
    Page<Task> filter(@Param("projectId") Long projectId,
                      @Param("boardId") Long boardId,
                      @Param("listId") Long listId,
                      @Param("sprintId") Long sprintId,
                      @Param("assigneeId") Long assigneeId,
                      @Param("priority") com.taskflow.task.constant.enums.Priority priority,
                      @Param("q") String q,
                      Pageable pageable);

    @Query("""
        SELECT t FROM Task t
        WHERE t.deleted = false AND t.assigneeId = :userId
          AND (:onlyOverdue = false OR (t.dueDate IS NOT NULL AND t.dueDate < :now))
          AND (:dueBefore IS NULL OR (t.dueDate IS NOT NULL AND t.dueDate <= :dueBefore))
        ORDER BY t.dueDate ASC NULLS LAST, t.priority ASC
        """)
    List<Task> dashboardForUser(@Param("userId") Long userId,
                                @Param("onlyOverdue") boolean onlyOverdue,
                                @Param("dueBefore") Long dueBefore,
                                @Param("now") Long now);

    @Modifying
    @Query("UPDATE Task t SET t.deleted = true WHERE t.projectId = :projectId AND t.deleted = false")
    int softDeleteByProject(@Param("projectId") Long projectId);

    @Modifying
    @Query("UPDATE Task t SET t.deleted = true WHERE t.boardId = :boardId AND t.deleted = false")
    int softDeleteByBoard(@Param("boardId") Long boardId);

    @Modifying
    @Query("UPDATE Task t SET t.deleted = true WHERE t.listId = :listId AND t.deleted = false")
    int softDeleteByList(@Param("listId") Long listId);

    List<Task> findByListIdAndDeletedFalseOrderByPositionAsc(Long listId);

    List<Task> findBySprintIdAndDeletedFalse(Long sprintId);
}
