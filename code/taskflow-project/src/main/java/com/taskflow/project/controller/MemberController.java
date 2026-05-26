package com.taskflow.project.controller;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.common.security.SecurityHeaderUtils;
import com.taskflow.project.dto.request.AddMemberRequest;
import com.taskflow.project.dto.request.ChangeRoleRequest;
import com.taskflow.project.dto.response.MemberResponse;
import com.taskflow.project.service.MemberService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/projects/{projectId}/members")
@RequiredArgsConstructor
public class MemberController {

    private final MemberService memberService;

    @GetMapping
    public ApiResponse<List<MemberResponse>> list(@PathVariable Long projectId) {
        return ApiResponse.ok(memberService.list(SecurityHeaderUtils.currentUserId(), projectId));
    }

    @PostMapping
    public ApiResponse<MemberResponse> add(@PathVariable Long projectId,
                                           @Valid @RequestBody AddMemberRequest req) {
        return ApiResponse.created("Member added",
                memberService.add(SecurityHeaderUtils.currentUserId(), projectId, req.getUserId(), req.getRole()));
    }

    @PutMapping("/{userId}/role")
    public ApiResponse<MemberResponse> changeRole(@PathVariable Long projectId,
                                                  @PathVariable Long userId,
                                                  @Valid @RequestBody ChangeRoleRequest req) {
        return ApiResponse.ok("Role updated",
                memberService.changeRole(SecurityHeaderUtils.currentUserId(), projectId, userId, req.getRole()));
    }

    @DeleteMapping("/{userId}")
    public ApiResponse<Void> remove(@PathVariable Long projectId, @PathVariable Long userId) {
        memberService.remove(SecurityHeaderUtils.currentUserId(), projectId, userId);
        return ApiResponse.ok("Member removed", null);
    }
}
