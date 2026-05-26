package com.taskflow.collab.dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ActivityLogResponse {
    private Long id;
    private String eventId;
    private Long projectId;
    private String targetType;
    private Long targetId;
    private String action;
    private Long actorId;

    /** Tên hiển thị của actor (resolved qua User Service); null nếu actor là hệ thống. */
    private String actorName;

    /** Câu mô tả tiếng Việt thân thiện, dành cho UI hiển thị trực tiếp. */
    private String message;

    /** Payload gốc của event, vẫn giữ để FE có thể tự render lại nếu cần. */
    private Map<String, Object> payload;

    private Long occurredAt;
}
