package com.taskflow.user.controller;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.common.exception.NotFoundException;
import com.taskflow.common.security.SecurityHeaderUtils;
import com.taskflow.user.dto.response.UserResponse;
import com.taskflow.user.service.AvatarStorageService;
import com.taskflow.user.service.UserService;
import io.minio.StatObjectResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@RestController
@RequiredArgsConstructor
public class AvatarController {

    private static final String PREFIX = "/api/v1/users/avatars/";

    private final UserService userService;
    private final AvatarStorageService storage;

    @PostMapping(value = "/api/v1/users/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<UserResponse> uploadMyAvatar(@RequestParam("file") MultipartFile file) {
        Long userId = SecurityHeaderUtils.currentUserId();

        // Delete previous file (best effort)
        UserResponse current = userService.getById(userId);
        if (current.getAvatarUrl() != null && !current.getAvatarUrl().startsWith("http")) {
            storage.delete(current.getAvatarUrl());
        }

        String key = storage.upload(userId, file);
        return ApiResponse.ok("Avatar uploaded", userService.updateAvatar(userId, key));
    }

    @GetMapping("/api/v1/users/avatars/**")
    public ResponseEntity<InputStreamResource> getAvatar(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (!uri.startsWith(PREFIX)) {
            throw NotFoundException.of("Avatar", uri);
        }
        String key = URLDecoder.decode(uri.substring(PREFIX.length()), StandardCharsets.UTF_8);

        try {
            StatObjectResponse stat = storage.stat(key);
            InputStream stream = storage.download(key);
            String contentType = stat.contentType();
            if (contentType == null || contentType.isBlank()) {
                contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
            }
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_TYPE, contentType)
                    .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                    .body(new InputStreamResource(stream));
        } catch (Exception e) {
            log.warn("Avatar not found: {} ({})", key, e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }
}
