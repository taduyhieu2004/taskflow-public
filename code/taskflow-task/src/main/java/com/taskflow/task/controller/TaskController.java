package com.taskflow.task.controller;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.common.dto.PageResponse;
import com.taskflow.common.security.SecurityHeaderUtils;
import com.taskflow.task.constant.enums.Priority;
import com.taskflow.task.dto.request.CreateTaskRequest;
import com.taskflow.task.dto.request.MoveTaskRequest;
import com.taskflow.task.dto.request.UpdateTaskRequest;
import com.taskflow.task.dto.response.TaskResponse;
import com.taskflow.task.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @PostMapping
    public ApiResponse<TaskResponse> create(@Valid @RequestBody CreateTaskRequest req) {
        return ApiResponse.created("Task created",
                taskService.create(SecurityHeaderUtils.currentUserId(), req));
    }

    @GetMapping("/{id}")
    public ApiResponse<TaskResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(taskService.get(SecurityHeaderUtils.currentUserId(), id));
    }

    @PutMapping("/{id}")
    public ApiResponse<TaskResponse> update(@PathVariable Long id, @Valid @RequestBody UpdateTaskRequest req) {
        return ApiResponse.ok("Task updated",
                taskService.update(SecurityHeaderUtils.currentUserId(), id, req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        taskService.delete(SecurityHeaderUtils.currentUserId(), id);
        return ApiResponse.ok("Task deleted", null);
    }

    @PostMapping("/{id}/restore")
    public ApiResponse<TaskResponse> restore(@PathVariable Long id) {
        return ApiResponse.ok("Task restored",
                taskService.restore(SecurityHeaderUtils.currentUserId(), id));
    }

    @PostMapping("/{id}/move")
    public ApiResponse<TaskResponse> move(@PathVariable Long id, @Valid @RequestBody MoveTaskRequest req) {
        return ApiResponse.ok("Task moved",
                taskService.move(SecurityHeaderUtils.currentUserId(), id, req));
    }

    @GetMapping
    public ApiResponse<PageResponse<TaskResponse>> filter(
            @RequestParam(value = "project_id", required = false) Long projectId,
            @RequestParam(value = "board_id", required = false) Long boardId,
            @RequestParam(value = "list_id", required = false) Long listId,
            @RequestParam(value = "sprint_id", required = false) Long sprintId,
            @RequestParam(value = "assignee_id", required = false) Long assigneeId,
            @RequestParam(required = false) Priority priority,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(taskService.filter(SecurityHeaderUtils.currentUserId(),
                projectId, boardId, listId, sprintId, assigneeId, priority, q, page, size));
    }
}
