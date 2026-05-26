package com.taskflow.collab.client;

import com.taskflow.common.dto.ApiResponse;
import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Lookup hiển thị tên người dùng theo batch. Dùng cho ActivityLogRenderer.
 *
 * Nếu User Service không khả dụng, fallback trả empty map — message render
 * sẽ dùng "Người dùng #{id}" thay cho tên thật, vẫn đọc được nhưng kém thân thiện.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class UserDirectoryClient {

    private final WebClient.Builder webClientBuilder;

    public record UserName(String username, String fullName) {
        /** Tên ưu tiên hiển thị: full name nếu có, ngược lại username. */
        public String display() {
            return (fullName != null && !fullName.isBlank()) ? fullName : username;
        }
    }

    @CircuitBreaker(name = "user-service", fallbackMethod = "lookupFallback")
    public Map<Long, UserName> lookup(Collection<Long> userIds) {
        if (userIds == null || userIds.isEmpty()) return Map.of();
        List<Long> ids = userIds.stream().filter(java.util.Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) return Map.of();

        ApiResponse<Map<Long, UserName>> resp = webClientBuilder.build()
                .post()
                .uri("http://taskflow-user/internal/users/names")
                .bodyValue(ids)
                .retrieve()
                .bodyToMono(new ParameterizedTypeReference<ApiResponse<Map<Long, UserName>>>() {})
                .timeout(Duration.ofSeconds(2))
                .block();
        if (resp == null || resp.getData() == null) return Map.of();
        return resp.getData();
    }

    @SuppressWarnings("unused")
    public Map<Long, UserName> lookupFallback(Collection<Long> userIds, Throwable ex) {
        log.warn("User Service unavailable for name lookup: {}", ex.getMessage());
        return Collections.emptyMap();
    }
}
