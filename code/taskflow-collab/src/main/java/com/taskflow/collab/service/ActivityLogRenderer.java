package com.taskflow.collab.service;

import com.taskflow.collab.client.UserDirectoryClient.UserName;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.stream.Collectors;

/**
 * Sinh câu mô tả tiếng Việt thân thiện cho mỗi entry Activity Log.
 *
 * Đầu vào: action (event_type), payload (data của event), bảng tra tên user.
 * Đầu ra: chuỗi như "Alice đã tạo công việc 'Implement login flow'".
 *
 * Nếu không nhận diện được action, fallback về dạng chung "đã thực hiện {action}".
 */
@Component
public class ActivityLogRenderer {

    public String render(String action, Map<String, Object> payload,
                          Long actorId, Map<Long, UserName> nameTable) {
        if (payload == null) payload = Map.of();
        String actor = displayName(actorId, nameTable);
        return switch (action == null ? "" : action) {
            // ===== Project =====
            case "project.created" ->
                    "%s đã tạo dự án '%s'".formatted(actor, str(payload, "name", "—"));
            case "project.deleted" ->
                    "%s đã xóa dự án".formatted(actor);

            case "project.member.added" ->
                    "%s đã thêm %s vào dự án với vai trò %s".formatted(
                            actor,
                            displayName(num(payload.get("user_id")), nameTable),
                            roleVi(str(payload, "role", "")));
            case "project.member.removed" ->
                    "%s đã xóa %s khỏi dự án".formatted(
                            actor,
                            displayName(num(payload.get("user_id")), nameTable));
            case "project.member.role_changed" ->
                    "%s đã đổi vai trò của %s từ %s sang %s".formatted(
                            actor,
                            displayName(num(payload.get("user_id")), nameTable),
                            roleVi(str(payload, "old_role", "")),
                            roleVi(str(payload, "new_role", "")));

            // ===== Board / List =====
            case "board.created" ->
                    "%s đã tạo bảng Kanban '%s'".formatted(actor, str(payload, "name", "—"));
            case "board.deleted" ->
                    "%s đã xóa một bảng Kanban".formatted(actor);
            case "list.created" ->
                    "%s đã tạo cột '%s'".formatted(actor, str(payload, "name", "—"));
            case "list.deleted" ->
                    "%s đã xóa một cột".formatted(actor);

            // ===== Task =====
            case "task.created" ->
                    "%s đã tạo công việc '%s'".formatted(actor, str(payload, "title", "—"));
            case "task.updated" -> {
                String title = taskTitle(payload);
                Object changes = payload.get("changes");
                if (changes instanceof Map<?, ?> m && !m.isEmpty()) {
                    String fields = m.keySet().stream()
                            .map(Object::toString).map(this::fieldVi)
                            .collect(Collectors.joining(", "));
                    yield "%s đã cập nhật công việc '%s' (%s)".formatted(actor, title, fields);
                }
                yield "%s đã cập nhật công việc '%s'".formatted(actor, title);
            }
            case "task.moved" -> {
                String title = taskTitle(payload);
                String fromName = str(payload, "from_list_name", null);
                String toName = str(payload, "to_list_name", null);
                if (fromName != null && toName != null) {
                    yield "%s đã chuyển công việc '%s' từ cột '%s' sang cột '%s'".formatted(
                            actor, title, fromName, toName);
                }
                yield "%s đã chuyển công việc '%s' sang cột khác".formatted(actor, title);
            }
            case "task.assigned" -> {
                String title = taskTitle(payload);
                Long newAssignee = num(payload.get("new_assignee_id"));
                Long oldAssignee = num(payload.get("old_assignee_id"));
                if (newAssignee == null) {
                    yield "%s đã bỏ giao công việc '%s'".formatted(actor, title);
                }
                String assignee = displayName(newAssignee, nameTable);
                if (oldAssignee == null) {
                    yield "%s đã giao công việc '%s' cho %s".formatted(actor, title, assignee);
                }
                yield "%s đã chuyển công việc '%s' từ %s sang %s".formatted(
                        actor, title, displayName(oldAssignee, nameTable), assignee);
            }
            case "task.deleted" ->
                    "%s đã xóa công việc '%s'".formatted(actor, taskTitle(payload));
            case "task.due_soon" ->
                    "Công việc '%s' sắp đến hạn (còn %s giờ)".formatted(
                            taskTitle(payload), str(payload, "hours_remaining", "?"));
            case "task.overdue" ->
                    "Công việc '%s' đã quá hạn".formatted(taskTitle(payload));
            case "task.dependency.changed" ->
                    "%s đã cập nhật quan hệ phụ thuộc của công việc '%s'".formatted(
                            actor, taskTitle(payload));

            // ===== Comment / Attachment =====
            case "comment.added" -> {
                String preview = str(payload, "content_preview", "");
                if (preview.length() > 60) preview = preview.substring(0, 60) + "…";
                yield preview.isEmpty()
                        ? "%s đã bình luận".formatted(actor)
                        : "%s đã bình luận: \"%s\"".formatted(actor, preview);
            }
            case "attachment.uploaded" ->
                    "%s đã đính kèm tệp '%s'".formatted(
                            actor, str(payload, "file_name", "—"));

            default -> "%s đã thực hiện hành động %s".formatted(actor, action);
        };
    }

    // ---------- helpers ----------

    private String displayName(Long userId, Map<Long, UserName> table) {
        if (userId == null) return "Hệ thống";
        UserName u = table == null ? null : table.get(userId);
        return u != null ? u.display() : "Người dùng #" + userId;
    }

    private static String str(Map<String, Object> m, String key, String fallback) {
        Object v = m.get(key);
        return v == null ? fallback : v.toString();
    }

    /** Lấy tiêu đề task: task.created dùng "title", các event task.* khác dùng "task_title". */
    private static String taskTitle(Map<String, Object> payload) {
        Object t = payload.get("task_title");
        if (t == null) t = payload.get("title");
        return t == null ? "—" : t.toString();
    }

    private static Long num(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        try { return Long.valueOf(o.toString()); } catch (NumberFormatException e) { return null; }
    }

    private String roleVi(String role) {
        return switch (role == null ? "" : role.toUpperCase()) {
            case "OWNER"     -> "Chủ sở hữu";
            case "ADMIN"     -> "Quản trị viên";
            case "EDITOR"    -> "Người chỉnh sửa";
            case "COMMENTER" -> "Người bình luận";
            case "VIEWER"    -> "Người xem";
            default          -> role;
        };
    }

    private String fieldVi(String field) {
        return switch (field == null ? "" : field) {
            case "title"        -> "tiêu đề";
            case "description"  -> "mô tả";
            case "due_date"     -> "hạn hoàn thành";
            case "priority"     -> "độ ưu tiên";
            case "assignee_id"  -> "người được giao";
            case "list_id"      -> "cột";
            case "position"     -> "vị trí";
            case "sprint_id"    -> "sprint";
            case "labels"       -> "nhãn";
            default             -> field;
        };
    }
}
