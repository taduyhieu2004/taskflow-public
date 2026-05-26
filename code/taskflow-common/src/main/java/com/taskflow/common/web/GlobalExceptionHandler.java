package com.taskflow.common.web;

import com.taskflow.common.dto.ApiResponse;
import com.taskflow.common.dto.ErrorPayload;
import com.taskflow.common.exception.BaseException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mỗi service extends class này và đặt @RestControllerAdvice ở subclass.
 * Pattern: cho phép service override / thêm handler riêng nếu cần.
 *
 * Message trả về cho FE/người dùng được tra cứu qua {@link ErrorMessageCatalog};
 * nếu không có mapping, dùng message mặc định trên exception kèm code làm gợi ý.
 */
@Slf4j
public abstract class GlobalExceptionHandler {

    @ExceptionHandler(BaseException.class)
    public ResponseEntity<ApiResponse<ErrorPayload>> handleBase(BaseException ex) {
        log.warn("Business exception: code={}, status={}, params={}",
                ex.getCode(), ex.getStatus(), ex.getParams());

        String humanMessage = resolveMessage(ex.getCode(), ex.getMessage());
        ErrorPayload payload = ErrorPayload.of(
                ex.getCode(),
                ex.getParams().isEmpty() ? humanMessage : ex.getParams()
        );
        return ResponseEntity.status(ex.getStatus())
                .body(ApiResponse.error(ex.getStatus(), humanMessage, payload));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<ErrorPayload>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        ErrorPayload payload = ErrorPayload.of("validation_error", fieldErrors);
        String message = resolveMessage("validation_error", "Validation Failed");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(ApiResponse.error(400, message, payload));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<ErrorPayload>> handleAll(Exception ex) {
        log.error("Unhandled exception", ex);
        String message = resolveMessage("internal_server_error", "Internal Server Error");
        ErrorPayload payload = ErrorPayload.of("internal_server_error", ex.getMessage());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(ApiResponse.error(500, message, payload));
    }

    /**
     * Tra cứu message tiếng Việt từ catalog. Nếu code chưa có trong catalog,
     * trả về message mặc định trên exception (vd "Bad Request") — nhắc nhở
     * dev bổ sung mapping vào {@link ErrorMessageCatalog}.
     */
    private static String resolveMessage(String code, String fallback) {
        String mapped = ErrorMessageCatalog.lookup(code);
        if (mapped != null) return mapped;
        log.debug("No message mapping for code '{}' — falling back to default", code);
        return fallback;
    }
}
