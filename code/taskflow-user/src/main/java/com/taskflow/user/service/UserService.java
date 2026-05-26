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

    String forgotPassword(ForgotPasswordRequest request);  // returns plaintext token (dev)

    void resetPassword(ResetPasswordRequest request);

    UserResponse getById(Long id);

    UserResponse updateProfile(Long userId, UpdateProfileRequest request);

    UserResponse updateAvatar(Long userId, String storageKey);

    PageResponse<UserResponse> search(String q, int page, int size);

    UserContactResponse getContact(Long id);

    User loadById(Long id);
}
