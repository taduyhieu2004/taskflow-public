package com.taskflow.collab.service;

import com.taskflow.collab.client.TaskServiceClient;
import com.taskflow.collab.client.UserDirectoryClient;
import com.taskflow.collab.client.UserDirectoryClient.UserName;
import com.taskflow.collab.dto.response.ActivityLogResponse;
import com.taskflow.collab.entity.ActivityLog;
import com.taskflow.collab.repository.ActivityLogRepository;
import com.taskflow.common.dto.PageResponse;
import com.taskflow.common.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository repo;
    private final AuthorizationService authz;
    private final TaskServiceClient taskClient;
    private final UserDirectoryClient userDirectory;
    private final ActivityLogRenderer renderer;

    public PageResponse<ActivityLogResponse> listForProject(Long callerId, Long projectId, int page, int size) {
        authz.requireMember(projectId, callerId);
        Page<ActivityLog> p = repo.findByProjectIdOrderByOccurredAtDesc(projectId, PageRequest.of(page, size));
        return PageResponse.of(p.map(buildMapper(p.getContent())));
    }

    public PageResponse<ActivityLogResponse> listForTask(Long callerId, Long taskId, int page, int size) {
        TaskServiceClient.TaskInfo info = taskClient.verify(taskId);
        if (!info.exists()) throw NotFoundException.of("Task", taskId);
        authz.requireMember(info.projectId(), callerId);

        Page<ActivityLog> p = repo.findByTaskId(taskId, PageRequest.of(page, size));
        return PageResponse.of(p.map(buildMapper(p.getContent())));
    }

    /**
     * Tạo mapper cho 1 trang activity log: trước tiên gom mọi userId xuất hiện
     * (actor + user_id/assignee_id/uploader_id trong payload), batch lookup tên
     * một lần, rồi mỗi entry render message dùng bảng tên đó.
     */
    private java.util.function.Function<ActivityLog, ActivityLogResponse> buildMapper(List<ActivityLog> logs) {
        Set<Long> userIds = collectUserIds(logs);
        Map<Long, UserName> nameTable = userDirectory.lookup(userIds);
        return a -> toResponse(a, nameTable);
    }

    private Set<Long> collectUserIds(List<ActivityLog> logs) {
        Set<Long> ids = new HashSet<>();
        for (ActivityLog a : logs) {
            if (a.getActorId() != null) ids.add(a.getActorId());
            Map<String, Object> p = a.getPayload();
            if (p == null) continue;
            for (String key : List.of("user_id", "assignee_id", "new_assignee_id",
                                       "old_assignee_id", "uploader_id", "author_id",
                                       "reporter_id", "invited_by", "removed_by",
                                       "changed_by")) {
                Long id = numFrom(p.get(key));
                if (id != null) ids.add(id);
            }
        }
        return ids;
    }

    private ActivityLogResponse toResponse(ActivityLog a, Map<Long, UserName> nameTable) {
        UserName actorName = a.getActorId() == null ? null : nameTable.get(a.getActorId());
        String message = renderer.render(a.getAction(), a.getPayload(), a.getActorId(), nameTable);

        return ActivityLogResponse.builder()
                .id(a.getId())
                .eventId(a.getEventId())
                .projectId(a.getProjectId())
                .targetType(a.getTargetType())
                .targetId(a.getTargetId())
                .action(a.getAction())
                .actorId(a.getActorId())
                .actorName(actorName != null ? actorName.display() : null)
                .message(message)
                .payload(a.getPayload())
                .occurredAt(a.getOccurredAt())
                .build();
    }

    private static Long numFrom(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.valueOf(o.toString()); } catch (NumberFormatException e) { return null; }
    }
}
