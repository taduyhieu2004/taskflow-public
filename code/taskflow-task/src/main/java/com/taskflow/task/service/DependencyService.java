package com.taskflow.task.service;

import com.taskflow.common.exception.BadRequestException;
import com.taskflow.common.exception.NotFoundException;
import com.taskflow.events.RoutingKeys;
import com.taskflow.events.dto.TaskEvents;
import com.taskflow.task.constant.enums.DependencyType;
import com.taskflow.task.dto.request.DependencyRequest;
import com.taskflow.task.dto.response.DependencyResponse;
import com.taskflow.task.entity.Task;
import com.taskflow.task.entity.TaskDependency;
import com.taskflow.task.messaging.TaskEventPublisher;
import com.taskflow.task.repository.TaskDependencyRepository;
import com.taskflow.task.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
public class DependencyService {

    private final TaskDependencyRepository depRepository;
    private final TaskRepository taskRepository;
    private final TaskEventPublisher publisher;
    private final AuthorizationService authz;

    public List<DependencyResponse> list(Long callerId, Long taskId) {
        Task t = loadTaskAndCheckMember(callerId, taskId);
        return depRepository.findByTaskIdAndDeletedFalse(taskId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public DependencyResponse add(Long callerId, Long taskId, DependencyRequest req) {
        Task t = loadTaskAndCheckEditor(callerId, taskId);
        if (taskId.equals(req.getDependsOnTaskId())) {
            throw new BadRequestException("self_dependency_not_allowed");
        }
        // Verify target task tồn tại
        taskRepository.findByIdAndDeletedFalse(req.getDependsOnTaskId())
                .orElseThrow(() -> NotFoundException.of("Task", req.getDependsOnTaskId()));

        if (depRepository.existsByTaskIdAndDependsOnTaskIdAndDeletedFalse(taskId, req.getDependsOnTaskId())) {
            throw new BadRequestException("dependency_already_exists");
        }

        // Cycle detection: nếu thêm taskId -> dependsOn, kiểm tra có path từ dependsOn về taskId không
        if (hasPath(req.getDependsOnTaskId(), taskId)) {
            throw new BadRequestException("cycle_detected");
        }

        TaskDependency d = new TaskDependency();
        d.setTaskId(taskId);
        d.setDependsOnTaskId(req.getDependsOnTaskId());
        d.setType(req.getType() == null ? DependencyType.BLOCKS : req.getType());
        d = depRepository.save(d);

        publisher.publish(RoutingKeys.TASK_DEPENDENCY_CHANGED, callerId,
                TaskEvents.DependencyChanged.builder()
                        .taskId(taskId).projectId(t.getProjectId())
                        .taskTitle(t.getTitle())
                        .added(List.of(TaskEvents.DependencyChanged.DependencyRef.builder()
                                .dependsOnTaskId(d.getDependsOnTaskId()).type(d.getType().name()).build()))
                        .removed(List.of()).build());

        return toResponse(d);
    }

    @Transactional
    public void remove(Long callerId, Long taskId, Long depId) {
        Task t = loadTaskAndCheckEditor(callerId, taskId);
        TaskDependency d = depRepository.findByIdAndDeletedFalse(depId)
                .orElseThrow(() -> NotFoundException.of("Dependency", depId));
        if (!d.getTaskId().equals(taskId)) {
            throw new BadRequestException("dependency_not_for_task");
        }
        d.setDeleted(true);
        depRepository.save(d);

        publisher.publish(RoutingKeys.TASK_DEPENDENCY_CHANGED, callerId,
                TaskEvents.DependencyChanged.builder()
                        .taskId(taskId).projectId(t.getProjectId())
                        .taskTitle(t.getTitle())
                        .added(List.of())
                        .removed(List.of(TaskEvents.DependencyChanged.DependencyRef.builder()
                                .dependsOnTaskId(d.getDependsOnTaskId()).type(d.getType().name()).build()))
                        .build());
    }

    /** DFS: có path từ start tới target qua các dependency hiện tại không? */
    private boolean hasPath(Long start, Long target) {
        Set<Long> visited = new HashSet<>();
        Deque<Long> stack = new ArrayDeque<>();
        stack.push(start);
        while (!stack.isEmpty()) {
            Long cur = stack.pop();
            if (cur.equals(target)) return true;
            if (!visited.add(cur)) continue;
            for (var d : depRepository.findByTaskIdAndDeletedFalse(cur)) {
                stack.push(d.getDependsOnTaskId());
            }
        }
        return false;
    }

    private Task loadTaskAndCheckMember(Long callerId, Long taskId) {
        Task t = taskRepository.findByIdAndDeletedFalse(taskId)
                .orElseThrow(() -> NotFoundException.of("Task", taskId));
        authz.requireMember(t.getProjectId(), callerId);
        return t;
    }

    private Task loadTaskAndCheckEditor(Long callerId, Long taskId) {
        Task t = taskRepository.findByIdAndDeletedFalse(taskId)
                .orElseThrow(() -> NotFoundException.of("Task", taskId));
        authz.requireRole(t.getProjectId(), callerId, "EDITOR");
        return t;
    }

    private DependencyResponse toResponse(TaskDependency d) {
        return DependencyResponse.builder()
                .id(d.getId()).taskId(d.getTaskId())
                .dependsOnTaskId(d.getDependsOnTaskId())
                .type(d.getType().name()).build();
    }
}
