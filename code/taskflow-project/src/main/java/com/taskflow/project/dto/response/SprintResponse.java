package com.taskflow.project.dto.response;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SprintResponse {
    private Long id;
    private Long projectId;
    private String name;
    private String goal;
    private Long startDate;
    private Long endDate;
    private String status;
    private Long closedAt;
    private Integer closedTotalTasks;
    private Integer closedDoneTasks;
    private Integer closedOverdueTasks;
}
