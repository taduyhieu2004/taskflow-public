package com.taskflow.task.controller;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.task.entity.Task;
import com.taskflow.task.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalController {

    private final TaskRepository taskRepository;

    /**
     * Đếm số task chưa xoá của 1 list. Project Service gọi vào trước khi xoá list
     * để chặn xoá khi list còn task.
     */
    @GetMapping("/lists/{listId}/task-count")
    public ApiResponse<Map<String, Object>> taskCount(@PathVariable Long listId) {
        int count = taskRepository.countByListIdAndDeletedFalse(listId);
        Map<String, Object> body = new HashMap<>();
        body.put("list_id", listId);
        body.put("count", count);
        return ApiResponse.ok(body);
    }

    @GetMapping("/tasks/{id}/exists")
    public ApiResponse<Map<String, Object>> exists(@PathVariable Long id) {
        var task = taskRepository.findByIdAndDeletedFalse(id);
        Map<String, Object> body = new HashMap<>();
        body.put("exists", task.isPresent());
        task.ifPresent(t -> {
            body.put("project_id", t.getProjectId());
            body.put("board_id", t.getBoardId());
            body.put("list_id", t.getListId());
        });
        return ApiResponse.ok(body);
    }

    /**
     * Snapshot số liệu sprint tại "ngay bây giờ".
     * Project Service gọi vào khi đóng sprint để chốt số liệu.
     *
     * @param sprintId      id sprint
     * @param doneListIdsCsv danh sách list_id được coi là "Done" (csv) — list cuối của
     *                       mỗi board trong project. Có thể rỗng → done = 0.
     */
    @GetMapping("/sprints/{sprintId}/snapshot")
    public ApiResponse<Map<String, Object>> sprintSnapshot(
            @PathVariable Long sprintId,
            @RequestParam(value = "done_list_ids", required = false, defaultValue = "") String doneListIdsCsv) {

        Set<Long> doneSet = new HashSet<>();
        if (!doneListIdsCsv.isBlank()) {
            Arrays.stream(doneListIdsCsv.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .forEach(s -> {
                        try { doneSet.add(Long.valueOf(s)); } catch (NumberFormatException ignore) {}
                    });
        }

        List<Task> tasks = taskRepository.findBySprintIdAndDeletedFalse(sprintId);
        long now = System.currentTimeMillis();

        int total = tasks.size();
        int done = 0;
        int overdue = 0;
        for (Task t : tasks) {
            boolean isDone = doneSet.contains(t.getListId());
            if (isDone) {
                done++;
            } else if (t.getDueDate() != null && t.getDueDate() < now) {
                overdue++;
            }
        }

        Map<String, Object> body = new HashMap<>();
        body.put("sprint_id", sprintId);
        body.put("total", total);
        body.put("done", done);
        body.put("overdue", overdue);
        return ApiResponse.ok(body);
    }
}
