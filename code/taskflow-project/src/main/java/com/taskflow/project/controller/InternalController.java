package com.taskflow.project.controller;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.common.exception.NotFoundException;
import com.taskflow.project.entity.BoardList;
import com.taskflow.project.entity.Board;
import com.taskflow.project.repository.BoardListRepository;
import com.taskflow.project.repository.BoardRepository;
import com.taskflow.project.repository.ProjectRepository;
import com.taskflow.project.service.AuthorizationService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalController {

    private final AuthorizationService authz;
    private final ProjectRepository projectRepository;
    private final BoardRepository boardRepository;
    private final BoardListRepository listRepository;

    @GetMapping("/projects/{id}/members/{userId}/role")
    public ApiResponse<Map<String, Object>> getRole(@PathVariable Long id, @PathVariable Long userId) {
        var role = authz.getRole(id, userId);
        Map<String, Object> body = new HashMap<>();
        body.put("project_id", id);
        body.put("user_id", userId);
        body.put("role", role == null ? null : role.name());
        return ApiResponse.ok(body);
    }

    @GetMapping("/projects/{id}/exists")
    public ApiResponse<Map<String, Boolean>> projectExists(@PathVariable Long id) {
        boolean exists = projectRepository.findByIdAndDeletedFalse(id).isPresent();
        return ApiResponse.ok(Map.of("exists", exists));
    }

    @GetMapping("/lists/{id}/board")
    public ApiResponse<Map<String, Object>> listBoard(@PathVariable Long id) {
        BoardList l = listRepository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> NotFoundException.of("List", id));
        Board b = boardRepository.findByIdAndDeletedFalse(l.getBoardId())
                .orElseThrow(() -> NotFoundException.of("Board", l.getBoardId()));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("list_id", id);
        body.put("board_id", b.getId());
        body.put("project_id", b.getProjectId());
        body.put("name", l.getName());
        return ApiResponse.ok(body);
    }

    /**
     * Batch lookup tên cột Kanban (list) theo nhiều listId. Dùng để snapshot
     * tên list vào event task.moved phục vụ Activity Log render câu thân thiện.
     */
    @PostMapping("/lists/names")
    public ApiResponse<Map<Long, String>> listNames(@RequestBody List<Long> listIds) {
        Map<Long, String> result = new LinkedHashMap<>();
        listRepository.findAllById(listIds).stream()
                .filter(l -> Boolean.FALSE.equals(l.getDeleted()))
                .forEach(l -> result.put(l.getId(), l.getName()));
        return ApiResponse.ok(result);
    }
}
