package com.taskflow.task.service;

import com.taskflow.common.dto.PageResponse;
import com.taskflow.task.constant.enums.Priority;
import com.taskflow.task.dto.request.CreateTaskRequest;
import com.taskflow.task.dto.request.MoveTaskRequest;
import com.taskflow.task.dto.request.UpdateTaskRequest;
import com.taskflow.task.dto.response.TaskResponse;

public interface TaskService {
    TaskResponse create(Long callerId, CreateTaskRequest req);
    TaskResponse get(Long callerId, Long taskId);
    TaskResponse update(Long callerId, Long taskId, UpdateTaskRequest req);
    void delete(Long callerId, Long taskId);
    TaskResponse restore(Long callerId, Long taskId);
    TaskResponse move(Long callerId, Long taskId, MoveTaskRequest req);
    PageResponse<TaskResponse> filter(Long callerId, Long projectId, Long boardId, Long listId,
                                      Long sprintId, Long assigneeId, Priority priority, String q,
                                      int page, int size);
}
