package com.taskflow.project.entity;

import com.taskflow.common.entity.AuditEntity;
import com.taskflow.project.constant.enums.SprintStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode(callSuper = true)
@Data
@Entity
@Table(name = "sprints")
public class Sprint extends AuditEntity {

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String goal;

    @Column(name = "start_date")
    private Long startDate;

    @Column(name = "end_date")
    private Long endDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SprintStatus status = SprintStatus.PLANNING;

    @Column(name = "closed_at")
    private Long closedAt;

    @Column(name = "closed_total_tasks")
    private Integer closedTotalTasks;

    @Column(name = "closed_done_tasks")
    private Integer closedDoneTasks;

    @Column(name = "closed_overdue_tasks")
    private Integer closedOverdueTasks;
}
