package com.taskflow.user.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Service gửi email cho User Service. Hiện hỗ trợ 2 loại:
 * - Reset password (link reset có token)
 * - Password changed alert (sau khi đổi pwd thành công)
 *
 * Tất cả gửi async để không chặn HTTP request chính.
 * Nếu SMTP fail, log lỗi nhưng không throw — flow forgot-password vẫn trả 200
 * generic cho client (chống email enumeration qua tín hiệu lỗi).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:TaskFlow <noreply@taskflow.dev>}")
    private String fromAddress;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Gửi email reset password với link click-thru. Token chỉ tồn tại trong
     * link (không lưu plaintext token ở bất cứ đâu khác ngoài bảng password_resets
     * dưới dạng hash).
     */
    @Async
    public void sendResetPasswordEmail(String to, String displayName, String plaintextToken) {
        String resetUrl = frontendUrl + "/reset-password?token=" + plaintextToken;
        String greeting = (displayName == null || displayName.isBlank())
                ? "bạn" : displayName;

        String html = """
            <!DOCTYPE html>
            <html>
            <body style="font-family: -apple-system, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
              <h2 style="color: #1d4ed8;">Đặt lại mật khẩu TaskFlow</h2>
              <p>Xin chào <b>%s</b>,</p>
              <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
                 Bấm vào nút bên dưới để chọn mật khẩu mới (link có hiệu lực trong 5 phút):</p>
              <p style="text-align: center; margin: 28px 0;">
                <a href="%s"
                   style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">
                  Đặt lại mật khẩu
                </a>
              </p>
              <p style="font-size: 13px; color: #6b7280;">
                Nếu nút không hoạt động, dán đường dẫn sau vào trình duyệt:<br/>
                <span style="word-break:break-all;color:#374151;">%s</span>
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;"/>
              <p style="font-size: 12px; color: #9ca3af;">
                Nếu bạn không yêu cầu đặt lại mật khẩu, có thể bỏ qua email này — tài khoản của bạn vẫn an toàn.
              </p>
            </body>
            </html>
            """.formatted(escape(greeting), resetUrl, resetUrl);

        send(to, "TaskFlow — Đặt lại mật khẩu", html);
    }

    /**
     * Email cảnh báo sau khi đổi mật khẩu thành công — user biết nếu không phải
     * chính mình đổi (security alert).
     */
    @Async
    public void sendPasswordChangedAlert(String to, String displayName) {
        String greeting = (displayName == null || displayName.isBlank()) ? "bạn" : displayName;
        String html = """
            <!DOCTYPE html>
            <html>
            <body style="font-family: -apple-system, Roboto, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
              <h2 style="color: #15803d;">Mật khẩu đã được đổi</h2>
              <p>Xin chào <b>%s</b>,</p>
              <p>Mật khẩu tài khoản TaskFlow của bạn vừa được đổi thành công.</p>
              <p>Nếu bạn không thực hiện thao tác này, vui lòng đổi lại mật khẩu ngay
                 hoặc liên hệ với quản trị viên hệ thống.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;"/>
              <p style="font-size: 12px; color: #9ca3af;">Email tự động từ hệ thống TaskFlow.</p>
            </body>
            </html>
            """.formatted(escape(greeting));
        send(to, "TaskFlow — Mật khẩu đã được đổi", html);
    }

    private void send(String to, String subject, String htmlBody) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, true, StandardCharsets.UTF_8.name());
            helper.setFrom(fromAddress);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(msg);
            log.info("Sent email to {} (subject: {})", to, subject);
        } catch (MessagingException | MailException e) {
            log.error("Failed to send email to {}: {}", to, e.getMessage());
        }
    }

    private static String escape(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
