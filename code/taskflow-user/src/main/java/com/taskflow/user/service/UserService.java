package com.taskflow.user.service;

import com.taskflow.common.dto.PageResponse;
import com.taskflow.user.dto.request.*;
import com.taskflow.user.dto.response.LoginResponse;
import com.taskflow.user.dto.response.UserContactResponse;
import com.taskflow.user.dto.response.UserResponse;
import com.taskflow.user.entity.User;

public interface UserService {

    UserResponse register(RegisterRequest request);

    LoginResponse login(LoginRequest request);

    LoginResponse refresh(RefreshRequest request);

    void logout(Long userId);

    void changePassword(Long userId, ChangePasswordRequest request);

    /**
     * Khởi tạo flow đặt lại mật khẩu: nếu email tồn tại → sinh token, lưu hash,
     * gửi email cho user. KHÔNG trả token plaintext qua API (chỉ qua email).
     * Email không tồn tại → vẫn không throw (chống email enumeration).
     */
    void forgotPassword(ForgotPasswordRequest request);

    void resetPassword(ResetPasswordRequest request);

    UserResponse getById(Long id);

    UserResponse updateProfile(Long userId, UpdateProfileRequest request);

    UserResponse updateAvatar(Long userId, String storageKey);

    PageResponse<UserResponse> search(String q, int page, int size);

    UserContactResponse getContact(Long id);

    User loadById(Long id);
}
