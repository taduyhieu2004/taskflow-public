package com.taskflow.task.client;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.common.exception.BadRequestException;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProjectServiceClient {

    private final WebClient.Builder webClientBuilder;

    public record ListBoardInfo(Long boardId, Long projectId, String name) {}

    @CircuitBreaker(name = "project-service", fallbackMethod = "getRoleFallback")
    public String getRole(Long projectId, Long userId) {
        ApiResponse<Map<String, Object>> resp = webClientBuilder.build()
                .get()
                .uri("http://taskflow-project/internal/projects/{id}/members/{userId}/role",
                        projectId, userId)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {})
                .timeout(Duration.ofSeconds(2))
                .block();
        if (resp == null || resp.getData() == null) return null;
        Object role = resp.getData().get("role");
        return role == null ? null : role.toString();
    }

    public String getRoleFallback(Long projectId, Long userId, Throwable ex) {
        log.warn("ProjectService unavailable when getRole({}, {}): {}", projectId, userId, ex.getMessage());
        throw new BadRequestException("project_service_unavailable");
    }

    @CircuitBreaker(name = "project-service", fallbackMethod = "getListBoardFallback")
    public ListBoardInfo getListBoard(Long listId) {
        try {
            ApiResponse<Map<String, Object>> resp = webClientBuilder.build()
                    .get()
                    .uri("http://taskflow-project/internal/lists/{id}/board", listId)
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {})
                    .timeout(Duration.ofSeconds(2))
                    .block();
            if (resp == null || resp.getData() == null) return null;
            Map<String, Object> d = resp.getData();
            Object name = d.get("name");
            return new ListBoardInfo(
                    Long.valueOf(d.get("board_id").toString()),
                    Long.valueOf(d.get("project_id").toString()),
                    name == null ? null : name.toString());
        } catch (WebClientResponseException.NotFound nf) {
            return null;
        }
    }

    @SuppressWarnings("unused")
    public ListBoardInfo getListBoardFallback(Long listId, Throwable ex) {
        log.warn("ProjectService unavailable when getListBoard({}): {}", listId, ex.getMessage());
        throw new BadRequestException("project_service_unavailable");
    }

    /**
     * Batch lookup tên list. Trả empty map khi service down (caller xử lý fallback).
     */
    @CircuitBreaker(name = "project-service", fallbackMethod = "getListNamesFallback")
    public Map<Long, String> getListNames(Collection<Long> listIds) {
        if (listIds == null || listIds.isEmpty()) return Collections.emptyMap();
        List<Long> ids = listIds.stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return Collections.emptyMap();
        ApiResponse<Map<Long, String>> resp = webClientBuilder.build()
                .post()
                .uri("http://taskflow-project/internal/lists/names")
                .bodyValue(ids)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<ApiResponse<Map<Long, String>>>() {})
                .timeout(Duration.ofSeconds(2))
                .block();
        return resp == null || resp.getData() == null ? Collections.emptyMap() : resp.getData();
    }

    @SuppressWarnings("unused")
    public Map<Long, String> getListNamesFallback(Collection<Long> listIds, Throwable ex) {
        log.warn("ProjectService unavailable when getListNames: {}", ex.getMessage());
        return Collections.emptyMap();
    }
}
