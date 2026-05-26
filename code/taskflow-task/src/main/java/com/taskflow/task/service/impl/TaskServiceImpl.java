package com.taskflow.task.service.impl;

import com.taskflow.common.dto.PageResponse;
import com.taskflow.common.exception.BadRequestException;
import com.taskflow.common.exception.NotFoundException;
import com.taskflow.events.RoutingKeys;
import com.taskflow.events.dto.TaskEvents;
import com.taskflow.task.client.ProjectServiceClient;
import com.taskflow.task.constant.enums.Priority;
import com.taskflow.task.dto.request.CreateTaskRequest;
import com.taskflow.task.dto.request.MoveTaskRequest;
import com.taskflow.task.dto.request.UpdateTaskRequest;
import com.taskflow.task.dto.response.TaskResponse;
import com.taskflow.task.entity.Task;
import com.taskflow.task.entity.TaskLabelMapping;
import com.taskflow.task.mapper.TaskMapper;
import com.taskflow.task.messaging.TaskEventPublisher;
import com.taskflow.task.repository.TaskLabelMappingRepository;
import com.taskflow.task.repository.TaskRepository;
import com.taskflow.task.repository.TaskWatcherRepository;
import com.taskflow.task.service.AuthorizationService;
import com.taskflow.task.service.TaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class TaskServiceImpl implements TaskService {

    private final TaskRepository taskRepository;
    private final TaskLabelMappingRepository labelMappingRepository;
    private final TaskWatcherRepository watcherRepository;
    private final TaskMapper mapper;
    private final TaskEventPublisher publisher;
    private final AuthorizationService authz;
    private final ProjectServiceClient projectClient;

    @Override
    @Transactional
    public TaskResponse create(Long callerId, CreateTaskRequest req) {
        // Verify list exists and get board/project
        ProjectServiceClient.ListBoardInfo info = projectClient.getListBoard(req.getListId());
        if (info == null) {
            throw NotFoundException.of("List", req.getListId());
        }

        authz.requireRole(info.projectId(), callerId, "EDITOR");

        Task t = new Task();
        t.setProjectId(info.projectId());
        t.setBoardId(info.boardId());
        t.setListId(req.getListId());
        t.setSprintId(req.getSprintId());
        t.setTitle(req.getTitle());
        t.setDescription(req.getDescription());
        t.setAssigneeId(req.getAssigneeId());
        t.setReporterId(callerId);
        t.setDueDate(req.getDueDate());
        t.setPriority(req.getPriority() == null ? Priority.MEDIUM : req.getPriority());
        t.setPosition(taskRepository.countByListIdAndDeletedFalse(req.getListId()));
        t = taskRepository.save(t);

        applyLabels(t.getId(), req.getLabelIds());

        publisher.publish(RoutingKeys.TASK_CREATED, callerId,
                TaskEvents.TaskCreated.builder()
                        .taskId(t.getId()).projectId(t.getProjectId())
                        .boardId(t.getBoardId()).listId(t.getListId())
                        .title(t.getTitle()).assigneeId(t.getAssigneeId())
                        .reporterId(t.getReporterId()).dueDate(t.getDueDate())
                        .priority(t.getPriority().name()).build());

        return toResponseWithLabels(t);
    }

    @Override
    public TaskResponse get(Long callerId, Long taskId) {
        Task t = loadTask(taskId);
        authz.requireMember(t.getProjectId(), callerId);
        return toResponseWithLabels(t);
    }

    @Override
    @Transactional
    public TaskResponse update(Long callerId, Long taskId, UpdateTaskRequest req) {
        Task t = loadTask(taskId);
        authz.requireRole(t.getProjectId(), callerId, "EDITOR");

        Map<String, TaskEvents.TaskUpdated.FieldChange> changes = new LinkedHashMap<>();
        if (req.getTitle() != null && !req.getTitle().equals(t.getTitle())) {
            changes.put("title", new TaskEvents.TaskUpdated.FieldChange(t.getTitle(), req.getTitle()));
            t.setTitle(req.getTitle());
        }
        if (req.getDescription() != null && !req.getDescription().equals(t.getDescription())) {
            t.setDescription(req.getDescription());
            changes.put("description", new TaskEvents.TaskUpdated.FieldChange("(was)", "(updated)"));
        }
        Long oldAssignee = t.getAssigneeId();
        if (req.getAssigneeId() != null && !req.getAssigneeId().equals(oldAssignee)) {
            t.setAssigneeId(req.getAssigneeId());
            // publish task.assigned riêng
            publisher.publish(RoutingKeys.TASK_ASSIGNED, callerId,
                    TaskEvents.TaskAssigned.builder()
                            .taskId(t.getId()).projectId(t.getProjectId())
                            .taskTitle(t.getTitle())
                            .oldAssigneeId(oldAssignee).newAssigneeId(req.getAssigneeId())
                            .build());
        }
        if (req.getDueDate() != null) {
            changes.put("due_date", new TaskEvents.TaskUpdated.FieldChange(t.getDueDate(), req.getDueDate()));
            t.setDueDate(req.getDueDate());
        }
        if (req.getPriority() != null && !req.getPriority().equals(t.getPriority())) {
            changes.put("priority", new TaskEvents.TaskUpdated.FieldChange(t.getPriority().name(), req.getPriority().name()));
            t.setPriority(req.getPriority());
        }
        if (req.getSprintId() != null) {
            t.setSprintId(req.getSprintId());
        }

        t = taskRepository.save(t);

        if (req.getLabelIds() != null) {
            labelMappingRepository.deleteByTaskId(t.getId());
            applyLabels(t.getId(), req.getLabelIds());
        }

        if (!changes.isEmpty()) {
            publisher.publish(RoutingKeys.TASK_UPDATED, callerId,
                    TaskEvents.TaskUpdated.builder()
                            .taskId(t.getId()).projectId(t.getProjectId())
                            .taskTitle(t.getTitle())
                            .changes(changes).build());
        }

        return toResponseWithLabels(t);
    }

    @Override
    @Transactional
    public void delete(Long callerId, Long taskId) {
        Task t = loadTask(taskId);
        authz.requireRole(t.getProjectId(), callerId, "EDITOR");

        // Snapshot info trước khi soft-delete để event mang đủ context cho noti
        java.util.List<Long> watcherIds = watcherRepository.findByTaskId(taskId).stream()
                .map(com.taskflow.task.entity.TaskWatcher::getUserId)
                .toList();

        t.setDeleted(true);
        taskRepository.save(t);

        publisher.publish(RoutingKeys.TASK_DELETED, callerId,
                TaskEvents.TaskDeleted.builder()
                        .taskId(t.getId())
                        .projectId(t.getProjectId())
                        .boardId(t.getBoardId())
                        .title(t.getTitle())
                        .assigneeId(t.getAssigneeId())
                        .watcherIds(watcherIds)
                        .build());
    }

    @Override
    @Transactional
    public TaskResponse restore(Long callerId, Long taskId) {
        Task t = taskRepository.findById(taskId)
                .orElseThrow(() -> NotFoundException.of("Task", taskId));
        authz.requireRole(t.getProjectId(), callerId, "EDITOR");
        if (!Boolean.TRUE.equals(t.getDeleted())) {
            throw new BadRequestException("task_not_deleted");
        }
        t.setDeleted(false);
        return toResponseWithLabels(taskRepository.save(t));
    }

    @Override
    @Transactional
    public TaskResponse move(Long callerId, Long taskId, MoveTaskRequest req) {
        Task t = loadTask(taskId);
        authz.requireRole(t.getProjectId(), callerId, "EDITOR");

        Long fromListId = t.getListId();
        if (req.getToListId().equals(fromListId)) {
            // Just reposition
            if (req.getPosition() != null) t.setPosition(req.getPosition());
            return toResponseWithLabels(taskRepository.save(t));
        }

        ProjectServiceClient.ListBoardInfo info = projectClient.getListBoard(req.getToListId());
        if (info == null) throw NotFoundException.of("List", req.getToListId());
        if (!info.projectId().equals(t.getProjectId())) {
            throw new BadRequestException("cannot_move_across_projects");
        }

        // Batch lookup tên cả 2 list để snapshot vào event (giúp Activity Log
        // render câu thân thiện mà không cần lookup khi đọc).
        java.util.Map<Long, String> listNames = projectClient.getListNames(
                java.util.List.of(fromListId, req.getToListId()));
        String fromName = listNames.get(fromListId);
        String toName = listNames.getOrDefault(req.getToListId(), info.name());

        t.setListId(req.getToListId());
        t.setBoardId(info.boardId());
        t.setPosition(req.getPosition() != null ? req.getPosition() :
                taskRepository.countByListIdAndDeletedFalse(req.getToListId()));

        t = taskRepository.save(t);

        publisher.publish(RoutingKeys.TASK_MOVED, callerId,
                TaskEvents.TaskMoved.builder()
                        .taskId(t.getId()).projectId(t.getProjectId())
                        .boardId(t.getBoardId())
                        .taskTitle(t.getTitle())
                        .fromListId(fromListId).fromListName(fromName)
                        .toListId(req.getToListId()).toListName(toName)
                        .newPosition(t.getPosition()).build());

        return toResponseWithLabels(t);
    }

    @Override
    public PageResponse<TaskResponse> filter(Long callerId, Long projectId, Long boardId, Long listId,
                                             Long sprintId, Long assigneeId, Priority priority, String q,
                                             int page, int size) {
        // If projectId provided → check member.
        // Otherwise filter to projects user is member of via assignee=callerId trick.
        if (projectId != null) {
            authz.requireMember(projectId, callerId);
        } else if (assigneeId == null) {
            // Phải có ít nhất projectId hoặc assigneeId để giới hạn (tránh leak data toàn DB)
            throw new BadRequestException("project_id_or_assignee_id_required");
        }

        Page<Task> result = taskRepository.filter(projectId, boardId, listId, sprintId, assigneeId, priority,
                q == null ? "" : q,
                PageRequest.of(page, size, Sort.by(Sort.Direction.ASC, "position")));
        return PageResponse.of(result.map(this::toResponseWithLabels));
    }

    private void applyLabels(Long taskId, List<Long> labelIds) {
        if (labelIds == null) return;
        for (Long labelId : labelIds) {
            TaskLabelMapping m = new TaskLabelMapping();
            m.setTaskId(taskId);
            m.setLabelId(labelId);
            labelMappingRepository.save(m);
        }
    }

    private TaskResponse toResponseWithLabels(Task t) {
        TaskResponse resp = mapper.toResponse(t);
        resp.setLabelIds(labelMappingRepository.findByTaskId(t.getId()).stream()
                .map(TaskLabelMapping::getLabelId).toList());
        return resp;
    }

    private Task loadTask(Long id) {
        return taskRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> NotFoundException.of("Task", id));
    }
}
