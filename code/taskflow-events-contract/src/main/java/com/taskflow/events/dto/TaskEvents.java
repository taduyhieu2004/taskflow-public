package com.taskflow.events.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

public final class TaskEvents {

    private TaskEvents() {}

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TaskCreated {
        private Long taskId;
        private Long projectId;
        private Long boardId;
        private Long listId;
        private String title;
        private Long assigneeId;
        private Long reporterId;
        private Long dueDate;
        private String priority;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TaskUpdated {
        private Long taskId;
        private Long projectId;
        // field name -> {"from": <old>, "to": <new>}
        private Map<String, FieldChange> changes;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
        public static class FieldChange {
            private Object from;
            private Object to;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TaskMoved {
        private Long taskId;
        private Long projectId;
        private Long boardId;
        private Long fromListId;
        private Long toListId;
        private Integer newPosition;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TaskAssigned {
        private Long taskId;
        private Long projectId;
        private Long oldAssigneeId;
        private Long newAssigneeId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TaskDeleted {
        private Long taskId;
        private Long projectId;
        private Long boardId;
        private String title;
        private Long assigneeId;
        private java.util.List<Long> watcherIds;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TaskDueSoon {
        private Long taskId;
        private Long projectId;
        private Long assigneeId;
        private Long dueDate;
        private Integer hoursRemaining;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TaskOverdue {
        private Long taskId;
        private Long projectId;
        private Long assigneeId;
        private Long dueDate;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class DependencyChanged {
        private Long taskId;
        private Long projectId;
        private List<DependencyRef> added;
        private List<DependencyRef> removed;

        @Data
        @Builder
        @NoArgsConstructor
        @AllArgsConstructor
        @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
        public static class DependencyRef {
            private Long dependsOnTaskId;
            private String type;
        }
    }
}
