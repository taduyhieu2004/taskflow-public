package com.taskflow.user.service;

import com.taskflow.common.exception.BadRequestException;
import com.taskflow.common.exception.InternalServerException;
import com.taskflow.user.config.MinioConfig;
import io.minio.GetObjectArgs;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AvatarStorageService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"
    );

    private static final long MAX_SIZE = 5 * 1024 * 1024L; // 5MB

    private final io.minio.MinioClient minio;
    private final MinioConfig cfg;

    public String upload(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("avatar_file_required");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw new BadRequestException("avatar_unsupported_format");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new BadRequestException("avatar_too_large");
        }

        String ext = extension(file.getOriginalFilename(), contentType);
        String key = "u" + userId + "/" + UUID.randomUUID() + ext;

        try (InputStream in = file.getInputStream()) {
            minio.putObject(PutObjectArgs.builder()
                    .bucket(cfg.getBucket())
                    .object(key)
                    .stream(in, file.getSize(), -1)
                    .contentType(contentType)
                    .build());
        } catch (Exception e) {
            log.error("Avatar upload failed: {}", e.getMessage(), e);
            throw new InternalServerException();
        }
        return key;
    }

    public StatObjectResponse stat(String key) {
        try {
            return minio.statObject(StatObjectArgs.builder()
                    .bucket(cfg.getBucket()).object(key).build());
        } catch (Exception e) {
            throw new InternalServerException();
        }
    }

    public InputStream download(String key) {
        try {
            return minio.getObject(GetObjectArgs.builder()
                    .bucket(cfg.getBucket()).object(key).build());
        } catch (Exception e) {
            throw new InternalServerException();
        }
    }

    public void delete(String key) {
        if (key == null || key.isBlank()) return;
        try {
            minio.removeObject(RemoveObjectArgs.builder()
                    .bucket(cfg.getBucket()).object(key).build());
        } catch (Exception e) {
            log.warn("Failed to delete avatar {}: {}", key, e.getMessage());
        }
    }

    private String extension(String filename, String contentType) {
        if (filename != null) {
            int idx = filename.lastIndexOf('.');
            if (idx > 0 && idx < filename.length() - 1) {
                String ext = filename.substring(idx).toLowerCase();
                if (ext.matches("\\.(png|jpg|jpeg|gif|webp)")) return ext;
            }
        }
        return switch (contentType.toLowerCase()) {
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> ".jpg";
        };
    }
}
