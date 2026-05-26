package com.taskflow.user.service.impl;

import com.taskflow.common.dto.PageResponse;
import com.taskflow.common.exception.BadRequestException;
import com.taskflow.common.exception.ConflictException;
import com.taskflow.common.exception.NotFoundException;
import com.taskflow.common.exception.UnauthorizedException;
import com.taskflow.user.constant.enums.TokenType;
import com.taskflow.user.constant.enums.UserStatus;
import com.taskflow.user.dto.request.*;
import com.taskflow.user.dto.response.LoginResponse;
import com.taskflow.user.dto.response.UserContactResponse;
import com.taskflow.user.dto.response.UserResponse;
import com.taskflow.user.entity.PasswordReset;
import com.taskflow.user.entity.User;
import com.taskflow.user.mapper.UserMapper;
import com.taskflow.user.repository.PasswordResetRepository;
import com.taskflow.user.repository.UserRepository;
import com.taskflow.user.service.EmailService;
import com.taskflow.user.service.TokenService;
import com.taskflow.user.service.TokenStore;
import com.taskflow.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordResetRepository passwordResetRepository;
    private final UserMapper userMapper;
    private final TokenService tokenService;
    private final TokenStore tokenStore;
    private final BCryptPasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Override
    @Transactional
    public UserResponse register(RegisterRequest request) {
        if (userRepository.existsByUsernameAndDeletedFalse(request.getUsername())) {
            throw new ConflictException("username_taken");
        }
        if (userRepository.existsByEmailAndDeletedFalse(request.getEmail())) {
            throw new ConflictException("email_taken");
        }

        User user = new User();
        user.setUsername(request.getUsername());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName());
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.save(user);

        return userMapper.toResponse(user);
    }

    @Override
    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsernameAndDeletedFalse(request.getUsername())
                .orElseThrow(() -> new UnauthorizedException("invalid_credentials"));

        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new UnauthorizedException("account_locked");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            user.setFailedAttempts(user.getFailedAttempts() + 1);
            if (user.getFailedAttempts() >= 5) {
                user.setStatus(UserStatus.LOCKED);
            }
            userRepository.save(user);
            throw new UnauthorizedException("invalid_credentials");
        }

        user.setFailedAttempts(0);
        user.setLastLoginAt(Instant.now().toEpochMilli());
        userRepository.save(user);

        return issueLoginTokens(user);
    }

    @Override
    public LoginResponse refresh(RefreshRequest request) {
        var claims = tokenService.parseClaims(request.getRefreshToken(), TokenType.REFRESH_TOKEN);
        Long userId = Long.parseLong((String) claims.get("sub"));

        if (!tokenStore.isValid(userId, TokenType.REFRESH_TOKEN, request.getRefreshToken())) {
            throw new UnauthorizedException("refresh_token_revoked");
        }

        User user = loadById(userId);
        return issueLoginTokens(user);
    }

    @Override
    public void logout(Long userId) {
        tokenStore.revokeAll(userId);
    }

    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        User user = loadById(userId);
        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new BadRequestException("old_password_incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        tokenStore.revokeAll(userId);
    }

    @Override
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmailAndDeletedFalse(request.getEmail()).orElse(null);
        if (user == null) {
            // Không throw — trả về 200 generic ở controller, chống email enumeration.
            log.info("Forgot password requested for non-existent email: {}", request.getEmail());
            return;
        }

        String plainToken = UUID.randomUUID().toString();
        PasswordReset reset = new PasswordReset();
        reset.setUserId(user.getId());
        reset.setTokenHash(sha256(plainToken));
        reset.setExpiresAt(Instant.now().toEpochMilli() + 5 * 60 * 1000L);
        reset.setUsed(false);
        passwordResetRepository.save(reset);

        // Gửi email (async). Token plaintext CHỈ tồn tại trong email — không qua API response, không lưu DB.
        emailService.sendResetPasswordEmail(user.getEmail(), user.getFullName(), plainToken);
        log.info("Sent reset password email for user {}", user.getId());
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        String hash = sha256(request.getToken());
        PasswordReset reset = passwordResetRepository.findByTokenHashAndUsedFalse(hash)
                .orElseThrow(() -> new BadRequestException("invalid_or_used_token"));
        if (reset.getExpiresAt() < Instant.now().toEpochMilli()) {
            throw new BadRequestException("token_expired");
        }

        User user = loadById(reset.getUserId());
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFailedAttempts(0);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.save(user);

        reset.setUsed(true);
        passwordResetRepository.save(reset);

        tokenStore.revokeAll(user.getId());

        // Email cảnh báo: nếu không phải user đổi, sẽ biết để xử lý sớm.
        emailService.sendPasswordChangedAlert(user.getEmail(), user.getFullName());
    }

    @Override
    public UserResponse getById(Long id) {
        return userMapper.toResponse(loadById(id));
    }

    @Override
    @Transactional
    public UserResponse updateProfile(Long userId, UpdateProfileRequest request) {
        User user = loadById(userId);
        userMapper.updateProfile(request, user);
        user = userRepository.save(user);

        return userMapper.toResponse(user);
    }

    @Override
    @Transactional
    public UserResponse updateAvatar(Long userId, String storageKey) {
        User user = loadById(userId);
        user.setAvatarUrl(storageKey);
        user = userRepository.save(user);
        return userMapper.toResponse(user);
    }

    @Override
    public PageResponse<UserResponse> search(String q, int page, int size) {
        if (q == null || q.isBlank()) {
            throw new BadRequestException("query_required");
        }
        Page<User> result = userRepository.search(q, PageRequest.of(page, size));
        return PageResponse.of(result.map(userMapper::toResponse));
    }

    @Override
    public UserContactResponse getContact(Long id) {
        return userMapper.toContact(loadById(id));
    }

    @Override
    public User loadById(Long id) {
        return userRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> NotFoundException.of("User", id));
    }

    private LoginResponse issueLoginTokens(User user) {
        String access = tokenService.createToken(user, TokenType.ACCESS_TOKEN);
        String refresh = tokenService.createToken(user, TokenType.REFRESH_TOKEN);
        tokenStore.save(user.getId(), TokenType.ACCESS_TOKEN, access,
                tokenService.getTtlMillis(TokenType.ACCESS_TOKEN));
        tokenStore.save(user.getId(), TokenType.REFRESH_TOKEN, refresh,
                tokenService.getTtlMillis(TokenType.REFRESH_TOKEN));

        return LoginResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .accessToken(access)
                .refreshToken(refresh)
                .tokenExpiredSeconds(tokenService.getTtlMillis(TokenType.ACCESS_TOKEN) / 1000)
                .refreshExpiredSeconds(tokenService.getTtlMillis(TokenType.REFRESH_TOKEN) / 1000)
                .tokenType("Bearer")
                .build();
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
