package com.taskflow.project.client;

import com.taskflow.common.dto.ApiResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

/**
 * Project Service → Task Service. Dùng để snapshot sprint khi đóng.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TaskServiceClient {

    private final WebClient.Builder webClientBuilder;

    @CircuitBreaker(name = "task-service", fallbackMethod = "sprintSnapshotFallback")
    public SprintSnapshot sprintSnapshot(Long sprintId, java.util.List<Long> doneListIds) {
        String doneCsv = doneListIds.stream().map(String::valueOf)
                .collect(java.util.stream.Collectors.joining(","));
        ApiResponse<Map<String, Object>> resp = webClientBuilder.build()
                .get()
                .uri(uri -> uri.scheme("http").host("taskflow-task")
                        .path("/internal/sprints/" + sprintId + "/snapshot")
                        .queryParam("done_list_ids", doneCsv)
                        .build())
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {})
                .timeout(Duration.ofSeconds(3))
                .block();

        if (resp == null || resp.getData() == null) {
            return SprintSnapshot.empty();
        }
        Map<String, Object> data = resp.getData();
        return new SprintSnapshot(
                ((Number) data.getOrDefault("total", 0)).intValue(),
                ((Number) data.getOrDefault("done", 0)).intValue(),
                ((Number) data.getOrDefault("overdue", 0)).intValue()
        );
    }

    public SprintSnapshot sprintSnapshotFallback(Long sprintId, java.util.List<Long> doneListIds, Throwable ex) {
        log.warn("Task service unavailable for sprint snapshot {}: {}", sprintId, ex.getMessage());
        return SprintSnapshot.empty();
    }

    public record SprintSnapshot(int total, int done, int overdue) {
        public static SprintSnapshot empty() {
            return new SprintSnapshot(0, 0, 0);
        }
    }

    /**
     * Đếm số task chưa xoá của 1 list. Trả về -1 nếu Task Service unavailable
     * → caller cần coi như "không xác định" và quyết định xử lý bảo thủ.
     */
    @CircuitBreaker(name = "task-service", fallbackMethod = "countTasksInListFallback")
    public int countTasksInList(Long listId) {
        ApiResponse<Map<String, Object>> resp = webClientBuilder.build()
                .get()
                .uri(uri -> uri.scheme("http").host("taskflow-task")
                        .path("/internal/lists/" + listId + "/task-count")
                        .build())
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {})
                .timeout(Duration.ofSeconds(2))
                .block();
        if (resp == null || resp.getData() == null) return 0;
        Object c = resp.getData().get("count");
        return c instanceof Number n ? n.intValue() : 0;
    }

    public int countTasksInListFallback(Long listId, Throwable ex) {
        log.warn("Task service unavailable when counting tasks for list {}: {}", listId, ex.getMessage());
        return -1;
    }
}
