package com.taskflow.user.controller;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.common.security.SecurityHeaderUtils;
import com.taskflow.user.dto.request.*;
import com.taskflow.user.dto.response.LoginResponse;
import com.taskflow.user.dto.response.UserResponse;
import com.taskflow.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserService userService;

    @PostMapping("/register")
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.created("User registered", userService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok("Login success", userService.login(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.ok("Token refreshed", userService.refresh(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout() {
        userService.logout(SecurityHeaderUtils.currentUserId());
        return ApiResponse.ok("Logged out", null);
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        userService.changePassword(SecurityHeaderUtils.currentUserId(), request);
        return ApiResponse.ok("Password changed", null);
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        // Luôn trả message generic — không tiết lộ email có tồn tại hay không.
        // Token plaintext chỉ tới user qua email (xem EmailService).
        userService.forgotPassword(request);
        return ApiResponse.ok(
                "Nếu email tồn tại trong hệ thống, link đặt lại mật khẩu đã được gửi.",
                null);
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(request);
        return ApiResponse.ok("Password reset", null);
    }
}
