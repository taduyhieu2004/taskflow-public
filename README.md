# TaskFlow — Hệ thống Quản lý Công việc & Kanban Board Phân tán

**TaskFlow** là một nền tảng quản lý dự án và cộng tác trực quan thời gian thực được thiết kế theo kiến trúc vi dịch vụ (Microservices). Ứng dụng hỗ trợ các nhóm làm việc cộng tác mượt mà, quản lý công việc qua các Kanban Board động, trao đổi qua bình luận và cập nhật trạng thái tức thời thông qua kết nối thời gian thực.

---

## ✨ Tính năng Nổi bật

- **Kanban Board Đa dạng & Trực quan:** Hỗ trợ tạo nhiều bảng công việc (Board) cho mỗi dự án, kéo thả chuyển trạng thái công việc mượt mà.
- **Cập nhật Thời gian thực (Real-time Collaboration):** Đồng bộ hóa tức thì trạng thái của các thẻ công việc (Task) và hoạt động trên bảng nhờ tích hợp WebSockets và Redis Pub/Sub.
- **Quản lý Công việc Toàn diện:** Gán người thực hiện (Assignee), đặt thời hạn (Deadline), thêm đính kèm tệp tin, viết bình luận, và theo dõi lịch sử hoạt động chi tiết.
- **Hệ thống Thông báo Thông minh:** Tự động gửi cảnh báo khi công việc sắp đến hạn, quá hạn hoặc khi được giao việc mới. Người dùng có thể tùy chỉnh nhận thông báo linh hoạt (qua ứng dụng hoặc Email).
- **Quản lý Thành viên & Phân quyền (RBAC):** Phân quyền chi tiết theo vai trò thành viên dự án (`OWNER`, `ADMIN`, `EDITOR`, `COMMENTER`, `VIEWER`).

---

## 🛠️ Công nghệ Sử dụng

### Frontend (`taskflow-fe`)
- **Core:** React 18, Vite, TypeScript
- **Styling:** Tailwind CSS, Shadcn UI
- **State Management & Data Fetching:** TanStack Query (React Query)
- **Real-time:** WebSockets

### Backend Microservices (`Spring Cloud`)
- **Dịch vụ Đăng ký & Cấu hình Hệ thống:**
  - `taskflow-eureka`: Spring Cloud Eureka Discovery Server (Đăng ký và phát hiện dịch vụ).
  - `taskflow-config`: Spring Cloud Config Server (Quản lý cấu hình tập trung cho toàn bộ service).
  - `taskflow-gateway`: Spring Cloud API Gateway (Cổng định tuyến duy nhất cho toàn hệ thống, xác thực token JWT, chạy ở port `8080`).
- **Các Dịch vụ Nghiệp vụ (Spring Boot):**
  - `taskflow-user` (User Service - Port `8081`): Xác thực người dùng (JWT), quản lý thông tin cá nhân và tải ảnh đại diện lên MinIO.
  - `taskflow-project` (Project Service - Port `8082`): Quản lý dự án, quản lý các bảng (Board) trong dự án và phân quyền thành viên.
  - `taskflow-task` (Task Service - Port `8083`): Quản lý thẻ công việc (Tasks), gán việc, và quản lý các cột trạng thái công việc.
  - `taskflow-collab` (Collab Service - Port `8084`): Quản lý các tương tác cộng tác như bình luận (Comments) và tệp đính kèm (Attachments) liên kết với MinIO.
  - `taskflow-notification` (Notification Service - Port `8085`): Xử lý cấu hình thông báo cá nhân, lưu trữ và gửi thông báo realtime (WebSocket) hoặc email.
- **Thư viện dùng chung:**
  - `taskflow-common`: Thư viện định nghĩa các cấu hình dùng chung (Security, Exception Handler, DTO, Database).
  - `taskflow-events-contract`: Định nghĩa các cấu hình Event Schema cho việc trao đổi message không đồng bộ qua RabbitMQ.

### Hạ tầng & Lưu trữ (Infrastructure)
- **Cơ sở dữ liệu:** PostgreSQL (Lưu trữ chính)
- **Caching & Message Broker:** Redis (Pub/Sub & Cache), RabbitMQ (Hàng đợi tin nhắn bất đồng bộ)
- **Object Storage:** MinIO (Tương thích S3 API, dùng lưu trữ ảnh đại diện và tệp đính kèm)

---

## 🚀 Hướng dẫn Cài đặt & Chạy Hệ thống

Để xem hướng dẫn chi tiết cách thiết lập môi trường, cấu hình và chạy hệ thống TaskFlow (bằng **Docker Compose** hoặc chạy **Manual từng dịch vụ** để phục vụ việc phát triển), vui lòng tham khảo tài liệu hướng dẫn tại đây:

👉 [**Tài liệu Hướng dẫn Cài đặt & Setup chi tiết (SETUP.md)**](file:///home/hieu/Documents/ms/SETUP.md)
