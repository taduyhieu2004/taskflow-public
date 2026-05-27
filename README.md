# TaskFlow

TaskFlow là hệ thống quản lý công việc theo mô hình Kanban Board, được phát triển trên kiến trúc Microservices sử dụng Spring Cloud (Java) và React (TypeScript).

Hệ thống hỗ trợ làm việc nhóm trực quan, cập nhật trạng thái công việc thời gian thực (Real-time), quản lý tệp đính kèm và phân quyền thành viên chặt chẽ theo dự án.

## Các chức năng chính

- **Bảng Kanban đa dạng:** Mỗi dự án có thể tạo nhiều board công việc khác nhau, kéo thả trạng thái linh hoạt.
- **Đồng bộ thời gian thực:** Trạng thái các task được đồng bộ tức thì giữa các thành viên nhờ WebSocket và Redis Pub/Sub.
- **Quản lý công việc chi tiết:** Giao việc (Assign), đặt deadline, đính kèm file, viết bình luận và theo dõi log hoạt động của task.
- **Cấu hình thông báo cá nhân:** Nhận thông báo qua Email hoặc In-app (hệ thống chuông báo) khi có công việc mới, quá hạn, hoặc được mời vào dự án.
- **Phân quyền thành viên (RBAC):** Phân quyền chi tiết theo vai trò thành viên trong dự án (`OWNER`, `ADMIN`, `EDITOR`, `COMMENTER`, `VIEWER`).

## Thành phần hệ thống

### Frontend
- **Mã nguồn:** Thư mục `code/taskflow-fe` (React 18, Vite, TypeScript, Tailwind CSS, TanStack Query).
- **Kết nối:** Giao tiếp qua REST API và WebSockets với Gateway.

### Backend Microservices (Spring Boot & Spring Cloud)
- **Hệ thống bổ trợ:**
  - `taskflow-eureka`: Service Registry để đăng ký và phát hiện dịch vụ.
  - `taskflow-config`: Quản lý cấu hình tập trung.
  - `taskflow-gateway` (Port `8080`): API Gateway điều phối request, xác thực token JWT.
- **Các service nghiệp vụ:**
  - `taskflow-user` (Port `8081`): Xác thực người dùng, thông tin cá nhân và upload avatar.
  - `taskflow-project` (Port `8082`): Quản lý dự án, boards, và thành viên dự án.
  - `taskflow-task` (Port `8083`): Quản lý thẻ công việc (Tasks) và cột trạng thái.
  - `taskflow-collab` (Port `8084`): Quản lý bình luận (Comments) và tệp đính kèm (Attachments).
  - `taskflow-notification` (Port `8085`): Quản lý cấu hình, lưu trữ và đẩy thông báo (WebSocket/Email).
- **Thư viện dùng chung:**
  - `taskflow-common`: Chứa cấu hình bảo mật, xử lý ngoại lệ và DTO dùng chung.
  - `taskflow-events-contract`: Chứa các Event Schema trao đổi qua RabbitMQ.

### Hạ tầng bổ trợ
- **Cơ sở dữ liệu:** PostgreSQL (lưu trữ dữ liệu nghiệp vụ).
- **Caching & Broker:** Redis (cache & pub/sub), RabbitMQ (hàng đợi message).
- **Object Storage:** MinIO (lưu trữ avatar và tệp đính kèm).

## Hướng dẫn cài đặt và khởi chạy

Vui lòng đọc file [SETUP.md](SETUP.md) để xem chi tiết hướng dẫn cấu hình môi trường và chạy hệ thống bằng Docker Compose hoặc chạy thủ công từng service.
