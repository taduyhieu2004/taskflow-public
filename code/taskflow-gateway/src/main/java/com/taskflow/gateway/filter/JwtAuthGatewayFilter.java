package com.taskflow.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.security.Key;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
public class JwtAuthGatewayFilter implements GlobalFilter, Ordered {

    private static final List<String> PUBLIC_PATHS = List.of(
            "/api/v1/auth/register",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
            "/api/v1/users/avatars/",
            "/actuator/",
            "/_blocked"
    );

    private final Key accessKey;
    private final ReactiveStringRedisTemplate redis;

    public JwtAuthGatewayFilter(@Value("${jwt.access-token.secret-key}") String secret,
                                ReactiveStringRedisTemplate redis) {
        this.accessKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.redis = redis;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // CORS preflight: bỏ qua JWT, để globalcors xử lý
        if (HttpMethod.OPTIONS.equals(request.getMethod())) {
            return chain.filter(exchange);
        }

        // Always pass trace id
        String traceId = request.getHeaders().getFirst("X-Trace-Id");
        if (traceId == null || traceId.isBlank()) {
            traceId = UUID.randomUUID().toString();
        }
        ServerHttpRequest mutated = request.mutate().header("X-Trace-Id", traceId).build();

        // Skip JWT for public paths
        if (isPublicPath(path)) {
            return chain.filter(exchange.mutate().request(mutated).build());
        }

        String auth = request.getHeaders().getFirst("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return unauthorized(exchange, "missing_token");
        }
        String token = auth.substring(7);

        Claims claims;
        try {
            claims = Jwts.parserBuilder().setSigningKey(accessKey).build()
                    .parseClaimsJws(token).getBody();
        } catch (Exception e) {
            log.debug("JWT validation failed: {}", e.getMessage());
            return unauthorized(exchange, "invalid_token");
        }

        String userId = claims.getSubject();
        String username = claims.get("username", String.class);
        String email = claims.get("email", String.class);

        // Check Redis (revocation)
        String redisKey = "jwt:" + userId + ":ACCESS_TOKEN";
        return redis.opsForValue().get(redisKey)
                .defaultIfEmpty("")
                .flatMap(stored -> {
                    if (!token.equals(stored)) {
                        return unauthorized(exchange, "token_revoked");
                    }
                    ServerHttpRequest req = mutated.mutate()
                            .header("X-User-Id", userId)
                            .header("X-Username", username == null ? "" : username)
                            .header("X-User-Email", email == null ? "" : email)
                            .build();
                    return chain.filter(exchange.mutate().request(req).build());
                });
    }

    private boolean isPublicPath(String path) {
        return PUBLIC_PATHS.stream().anyMatch(path::startsWith);
    }

    private Mono<Void> unauthorized(ServerWebExchange exchange, String code) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        exchange.getResponse().getHeaders().add("X-Error-Code", code);
        return exchange.getResponse().setComplete();
    }

    @Override
    public int getOrder() {
        return -100; // run before routing
    }
}
