package com.taskflow.user.controller;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.user.dto.response.UserContactResponse;
import com.taskflow.user.repository.UserRepository;
import com.taskflow.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/internal/users")
@RequiredArgsConstructor
public class InternalController {

    private final UserService userService;
    private final UserRepository userRepository;

    @GetMapping("/{id}/contact")
    public ApiResponse<UserContactResponse> contact(@PathVariable Long id) {
        return ApiResponse.ok(userService.getContact(id));
    }

    @PostMapping("/exists")
    public ApiResponse<Map<Long, Boolean>> exists(@RequestBody List<Long> userIds) {
        var existing = userRepository.findAllById(userIds).stream()
                .filter(u -> Boolean.FALSE.equals(u.getDeleted()))
                .map(u -> u.getId())
                .toList();
        var result = new LinkedHashMap<Long, Boolean>();
        for (Long id : userIds) result.put(id, existing.contains(id));
        return ApiResponse.ok(result);
    }

    /**
     * Batch lookup tên hiển thị cho nhiều userId cùng lúc.
     * Trả map userId → {username, fullName}. ID không tồn tại bị bỏ qua.
     * Dùng cho Collab render Activity Log, Notification render @mention, …
     */
    @PostMapping("/names")
    public ApiResponse<Map<Long, NameEntry>> names(@RequestBody List<Long> userIds) {
        Map<Long, NameEntry> result = new LinkedHashMap<>();
        userRepository.findAllById(userIds).stream()
                .filter(u -> Boolean.FALSE.equals(u.getDeleted()))
                .forEach(u -> result.put(u.getId(),
                        new NameEntry(u.getUsername(), u.getFullName())));
        return ApiResponse.ok(result);
    }

    public record NameEntry(String username, String fullName) {}
}
