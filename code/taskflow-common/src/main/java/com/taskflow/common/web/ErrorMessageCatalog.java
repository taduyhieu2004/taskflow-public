package com.taskflow.common.web;

import java.util.Map;

/**
 * Map mã lỗi nội bộ → câu thông báo tiếng Việt thân thiện với người dùng.
 * GlobalExceptionHandler tra cứu map này để gắn vào trường message của response.
 *
 * Quy ước:
 * - Key trùng với mã code truyền vào BaseException (vd "user_already_member").
 * - Một số message dùng placeholder {0}, {1}... lấy từ exception.params theo thứ tự key.
 */
public final class ErrorMessageCatalog {

    private ErrorMessageCatalog() {}

    private static final Map<String, String> MESSAGES = Map.ofEntries(
            // ===== Auth / User Service =====
            Map.entry("invalid_credentials",     "Tên đăng nhập hoặc mật khẩu không đúng"),
            Map.entry("account_locked",          "Tài khoản đã bị khóa do nhập sai mật khẩu nhiều lần"),
            Map.entry("username_taken",          "Tên đăng nhập đã được sử dụng"),
            Map.entry("email_taken",             "Địa chỉ email đã được đăng ký"),
            Map.entry("old_password_incorrect",  "Mật khẩu hiện tại không đúng"),
            Map.entry("invalid_token",           "Token không hợp lệ hoặc đã hết hạn"),
            Map.entry("token_expired",           "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại"),
            Map.entry("refresh_token_revoked",   "Refresh token đã bị thu hồi"),
            Map.entry("missing_user_id_header",  "Thiếu thông tin định danh người dùng"),
            Map.entry("invalid_user_id_header",  "Thông tin định danh người dùng không hợp lệ"),
            Map.entry("no_request_context",      "Không xác định được ngữ cảnh yêu cầu"),
            Map.entry("user_not_found",          "Không tìm thấy người dùng"),

            // ===== Upload / file =====
            Map.entry("avatar_file_required",    "Vui lòng chọn ảnh đại diện để tải lên"),
            Map.entry("avatar_too_large",        "Ảnh đại diện vượt quá dung lượng cho phép"),
            Map.entry("avatar_unsupported_format", "Định dạng ảnh đại diện không được hỗ trợ"),
            Map.entry("file_required",           "Vui lòng chọn tệp để tải lên"),
            Map.entry("file_too_large",          "Tệp vượt quá dung lượng cho phép (25 MB)"),
            Map.entry("unsupported_media_type",  "Định dạng tệp không được hỗ trợ"),

            // ===== Project Service =====
            Map.entry("project_key_taken",       "Mã dự án (key) đã được sử dụng, vui lòng chọn mã khác"),
            Map.entry("not_a_member",            "Bạn không phải thành viên của dự án này"),
            Map.entry("insufficient_role",       "Bạn không có quyền thực hiện thao tác này"),
            Map.entry("not_owner",               "Chỉ chủ sở hữu dự án mới được thực hiện thao tác này"),
            Map.entry("user_already_member",     "Người dùng đã là thành viên của dự án"),
            Map.entry("only_owner_can_assign_admin_or_owner",
                    "Chỉ chủ sở hữu dự án mới được phép gán vai trò Quản trị viên hoặc Chủ sở hữu"),
            Map.entry("only_owner_can_modify_admin",
                    "Chỉ chủ sở hữu dự án mới được phép thay đổi vai trò của Quản trị viên"),
            Map.entry("only_owner_can_remove_admin",
                    "Chỉ chủ sở hữu dự án mới được phép xóa Quản trị viên"),
            Map.entry("cannot_change_owner_role",
                    "Không thể thay đổi vai trò của Chủ sở hữu, hãy chuyển quyền sở hữu trước"),
            Map.entry("cannot_remove_owner",
                    "Không thể xóa Chủ sở hữu khỏi dự án, hãy chuyển quyền sở hữu trước"),
            Map.entry("list_not_in_board",       "Cột không thuộc về bảng được chọn"),
            Map.entry("sprint_end_date_before_start_date",
                    "Ngày kết thúc sprint phải sau ngày bắt đầu"),
            Map.entry("sprint_already_active_in_project",
                    "Dự án đã có một sprint đang chạy, hãy đóng sprint hiện tại trước"),

            // ===== Task Service =====
            Map.entry("cycle_detected",          "Phụ thuộc tạo thành vòng tròn, không thể thêm"),
            Map.entry("dependency_already_exists","Quan hệ phụ thuộc đã tồn tại"),
            Map.entry("dependency_not_for_task", "Quan hệ phụ thuộc không thuộc về công việc này"),
            Map.entry("self_dependency_not_allowed",
                    "Công việc không thể phụ thuộc vào chính nó"),
            Map.entry("cannot_move_across_projects",
                    "Không thể di chuyển công việc sang dự án khác"),
            Map.entry("task_not_deleted",        "Công việc không ở trạng thái đã xóa"),
            Map.entry("label_name_taken",        "Tên nhãn đã được sử dụng trong dự án"),
            Map.entry("project_id_or_assignee_id_required",
                    "Cần cung cấp ít nhất project_id hoặc assignee_id"),
            Map.entry("query_required",          "Vui lòng nhập từ khóa tìm kiếm"),

            // ===== Resource not found (NotFoundException.of) =====
            Map.entry("project_not_found",       "Không tìm thấy dự án"),
            Map.entry("board_not_found",         "Không tìm thấy bảng Kanban"),
            Map.entry("list_not_found",          "Không tìm thấy cột Kanban"),
            Map.entry("sprint_not_found",        "Không tìm thấy sprint"),
            Map.entry("task_not_found",          "Không tìm thấy công việc"),
            Map.entry("comment_not_found",       "Không tìm thấy bình luận"),
            Map.entry("attachment_not_found",    "Không tìm thấy tệp đính kèm"),
            Map.entry("label_not_found",         "Không tìm thấy nhãn"),
            Map.entry("notification_not_found",  "Không tìm thấy thông báo"),
            Map.entry("member_not_found",        "Không tìm thấy thành viên trong dự án"),
            Map.entry("checklist_not_found",     "Không tìm thấy checklist"),
            Map.entry("checklist_item_not_found","Không tìm thấy mục trong checklist"),

            // ===== Service unavailable / circuit breaker =====
            Map.entry("project_service_unavailable",
                    "Hệ thống Dự án tạm thời không khả dụng, vui lòng thử lại sau"),
            Map.entry("user_service_unavailable",
                    "Hệ thống Người dùng tạm thời không khả dụng, vui lòng thử lại sau"),
            Map.entry("task_service_unavailable",
                    "Hệ thống Công việc tạm thời không khả dụng, vui lòng thử lại sau"),

            // ===== Generic fallback codes (raised by handlers) =====
            Map.entry("forbidden",               "Bạn không có quyền truy cập tài nguyên này"),
            Map.entry("validation_error",        "Dữ liệu gửi lên không hợp lệ"),
            Map.entry("internal_server_error",   "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau"),
            Map.entry("conflict",                "Yêu cầu xung đột với trạng thái hiện tại")
    );

    /**
     * Tra cứu message cho code. Trả về null nếu không có mapping
     * (caller có thể fallback về message mặc định).
     */
    public static String lookup(String code) {
        if (code == null) return null;
        return MESSAGES.get(code);
    }
}
