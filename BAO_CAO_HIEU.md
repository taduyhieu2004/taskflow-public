# PHẦN BÁO CÁO — HIẾU PHỤ TRÁCH

> Tài liệu này chứa nội dung báo cáo cho năm tiểu mục **3.4, 3.5, 3.6, 3.7,
> 3.8** thuộc Chương 3 "PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG" của Báo cáo Bài tập
> lớn môn Phát triển Hệ thống Thương mại điện tử — đề tài TaskFlow.
> Các tiểu mục còn lại do Hậu và Tường phụ trách theo phân công gốc.

---

## 3.4. Thiết kế cơ sở dữ liệu

### 3.4.1. Nguyên tắc thiết kế Database-per-Service

Một trong những đặc trưng quan trọng nhất phân biệt kiến trúc microservice với
kiến trúc monolithic truyền thống nằm ở cách tổ chức cơ sở dữ liệu. Trong hệ
thống monolithic, mọi mô-đun thường dùng chung một cơ sở dữ liệu tập trung,
mọi truy vấn được thực hiện trực tiếp với khả năng tham chiếu khóa ngoại
xuyên mô-đun. Mô hình này tuy thuận tiện cho phát triển ban đầu nhưng khi quy
mô tăng lên sẽ trở thành "shared database anti-pattern": chỉ cần một thay
đổi nhỏ ở schema cũng có thể kéo theo dây chuyền các mô-đun khác, deploy
độc lập trở nên gần như bất khả thi, và mỗi nhóm phát triển không thể tự
quyết về lưu trữ dữ liệu của mình.

Trên cơ sở đó, hệ thống TaskFlow áp dụng triệt để nguyên tắc
**Database-per-Service**: mỗi microservice sở hữu một cơ sở dữ liệu PostgreSQL
riêng biệt, là chủ thể duy nhất có quyền truy cập vật lý vào dữ liệu của
nó. Không một service nào được phép kết nối trực tiếp vào cơ sở dữ liệu của
service khác; mọi nhu cầu đọc/ghi dữ liệu xuyên ranh giới đều phải đi qua
giao diện REST nội bộ hoặc kênh sự kiện RabbitMQ. Toàn bộ hệ thống bao gồm
năm cơ sở dữ liệu độc lập, được thể hiện trong bảng dưới đây.

**Bảng 3.4.1. Danh sách các cơ sở dữ liệu của hệ thống TaskFlow**

| STT | Tên cơ sở dữ liệu | Service sở hữu | Vai trò chính |
|---|---|---|---|
| 1 | `taskflow_user` | User Service | Tài khoản người dùng, hồ sơ cá nhân, token đặt lại mật khẩu |
| 2 | `taskflow_project` | Project Service | Dự án, bảng Kanban, cột, sprint, thành viên dự án |
| 3 | `taskflow_task` | Task Service | Công việc, checklist, nhãn, phụ thuộc, người theo dõi |
| 4 | `taskflow_collab` | Collaboration Service | Bình luận, tệp đính kèm, nhật ký hoạt động |
| 5 | `taskflow_notif` | Notification Service | Thông báo và tùy chọn thông báo của người dùng |

Mô hình Database-per-Service mang lại bốn lợi ích cốt lõi cho hệ thống. Thứ
nhất, mỗi nhóm phát triển có quyền hoàn toàn với schema thuộc service của
mình, có thể đổi cấu trúc bảng, thêm cột, đổi kiểu dữ liệu mà không lo phá
vỡ các service khác. Thứ hai, mỗi cơ sở dữ liệu được scale độc lập theo
nhu cầu thực tế — ví dụ Notification Service ghi nhiều, đọc nhiều có thể
được tách shard hoặc nhân bản đọc, trong khi User Service vốn ổn định
thì giữ nguyên một instance. Thứ ba, sự cố ở một cơ sở dữ liệu được khoanh
vùng: nếu cơ sở dữ liệu của Notification gặp lỗi, các nghiệp vụ chính
(quản lý dự án, công việc, bình luận) vẫn vận hành bình thường. Thứ tư,
nguyên tắc này cho phép sau này chuyển đổi sang lưu trữ phù hợp hơn cho
từng loại tải mà không cần làm lại toàn hệ thống — ví dụ đưa Activity Log
sang Cassandra, hoặc đưa Notification sang Redis Streams.

Tất nhiên việc tách cơ sở dữ liệu cũng đi kèm hai thách thức quan trọng.
Thứ nhất, không thể dùng transaction phân tán theo kiểu hai pha vốn quá
tốn kém và dễ tạo điểm thắt cổ chai; thay vào đó, hệ thống chấp nhận
**tính nhất quán cuối cùng** (eventual consistency) và sử dụng cơ chế
truyền tin bất đồng bộ để các service đồng bộ trạng thái với nhau. Thứ
hai, do không tồn tại khóa ngoại xuyên service, các tham chiếu cross-service
(`user_id`, `project_id`, `task_id`...) chỉ được lưu dưới dạng số nguyên dài
(`BIGINT`); tính toàn vẹn được đảm bảo bằng hai cơ chế kết hợp — kiểm tra
khi tạo resource thông qua REST gọi sang service sở hữu, và xử lý cascade
qua sự kiện khi resource gốc bị xóa.

### 3.4.2. Lớp AuditEntity dùng chung

Để bảo đảm tính nhất quán về quy ước truy vết dữ liệu giữa các service, hệ
thống định nghĩa một lớp cha trừu tượng tên là `AuditEntity` trong thư viện
dùng chung `taskflow-common`. Mọi entity nghiệp vụ — từ `User`, `Project`,
`Task` cho đến `Comment`, `Notification` — đều kế thừa lớp này. Nhờ đó, tất
cả bảng trong toàn hệ thống đều có sáu cột kỹ thuật được tự động sinh ra,
giúp tiết kiệm code lặp lại đồng thời giữ thiết kế đồng nhất.

**Bảng 3.4.2. Các cột kỹ thuật chuẩn của lớp AuditEntity**

| Cột | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| `id` | `BIGSERIAL` (khóa chính) | Khóa chính tự tăng |
| `created_by` | `varchar(255)` | Tên đăng nhập người tạo |
| `created_at` | `bigint` | Thời điểm tạo (epoch milliseconds) |
| `last_updated_by` | `varchar(255)` | Tên đăng nhập người sửa lần cuối |
| `last_updated_at` | `bigint` | Thời điểm sửa lần cuối (epoch milliseconds) |
| `deleted` | `boolean` | Cờ đánh dấu đã xóa mềm, mặc định `false` |

Một quyết định thiết kế đáng chú ý là việc dùng kiểu `bigint` lưu epoch
milliseconds thay cho kiểu `timestamp` truyền thống của PostgreSQL. Có ba lý
do cho lựa chọn này. Thứ nhất, khi thông tin thời gian phải đi qua nhiều
service đặt ở các múi giờ hoặc cấu hình khác nhau, việc dùng giá trị nguyên
giúp loại bỏ hoàn toàn rủi ro sai lệch múi giờ. Thứ hai, định dạng số nguyên
tương thích trực tiếp với trường thời gian trong payload JSON của các sự
kiện RabbitMQ, không cần serialize/deserialize trung gian. Thứ ba, các phép
so sánh, sắp xếp và lập chỉ mục trên kiểu nguyên hoạt động hiệu quả hơn so
với kiểu timestamp có timezone.

Liên quan đến cờ `deleted`, hệ thống áp dụng nguyên tắc **soft delete**
thay vì xóa vật lý. Khi người dùng yêu cầu xóa một công việc, nhãn hay
bình luận, bản ghi không bị xóa khỏi cơ sở dữ liệu mà chỉ được đánh dấu
`deleted = true`; mọi truy vấn nghiệp vụ đều thêm điều kiện
`deleted = false` để bỏ qua dữ liệu đã xóa. Cơ chế này phục vụ hai mục đích:
hỗ trợ chức năng "Thùng rác" cho phép khôi phục công việc trong vòng 30
ngày, đồng thời bảo toàn dữ liệu lịch sử cho Activity Log để truy vết về
sau. Riêng bảng `activity_logs` là ngoại lệ — vì bản chất append-only của
nhật ký, bảng này không cần cờ `deleted`.

### 3.4.3. Cơ sở dữ liệu User Service

Cơ sở dữ liệu `taskflow_user` chứa hai bảng nghiệp vụ. Bảng `users` là bảng
trung tâm, lưu trữ thông tin tài khoản với các trường chính như tên đăng
nhập, địa chỉ thư điện tử, mã băm mật khẩu (sử dụng thuật toán BCrypt với
salt ngẫu nhiên), họ tên đầy đủ, ảnh đại diện, mô tả ngắn, ngày sinh, trạng
thái tài khoản và một số trường phục vụ cơ chế khóa tài khoản. Trạng thái
tài khoản được mô hình hóa dưới dạng enum với ba giá trị `ACTIVE`, `LOCKED`
và `INACTIVE`. Đặc biệt, hai trường `failed_attempts` và `last_login_at`
phục vụ chính sách bảo mật cơ bản: nếu một tài khoản đăng nhập thất bại quá
năm lần liên tiếp, hệ thống sẽ tự động chuyển trạng thái sang `LOCKED` và
yêu cầu reset mật khẩu trước khi đăng nhập lại.

Bảng thứ hai là `password_resets`, lưu các token đặt lại mật khẩu được
sinh ra khi người dùng yêu cầu chức năng "Quên mật khẩu". Mỗi token sống
trong vòng 30 phút và chỉ được sử dụng đúng một lần. Để bảo mật, hệ thống
không lưu token gốc mà chỉ lưu giá trị băm SHA-256 của nó; khi người dùng
gửi yêu cầu reset, server băm token nhận được rồi so sánh với cột
`token_hash`. Cờ `used` đảm bảo một token không thể bị tái sử dụng — sau
lần đầu thành công, cờ được đặt thành `true` và mọi yêu cầu tiếp theo với
token này đều bị từ chối.

Bảng `users` có hai chỉ mục duy nhất là `idx_users_email` và
`idx_users_username` để hỗ trợ truy vấn đăng nhập (vốn phải thực thi với độ
trễ rất thấp). Bảng `password_resets` có chỉ mục theo `token_hash` để tra
cứu nhanh khi xác thực yêu cầu reset.

### 3.4.4. Cơ sở dữ liệu Project Service

Cơ sở dữ liệu `taskflow_project` mô hình hóa cấu trúc tổ chức công việc
theo phong cách lấy cảm hứng từ Trello và Jira. Năm bảng nghiệp vụ chính
gồm `projects`, `project_members`, `boards`, `lists` và `sprints` có quan
hệ cha-con đa cấp như sau: một dự án chứa nhiều bảng (board), một bảng
chứa nhiều cột (list), một dự án có nhiều thành viên (project_members) và
nhiều sprint.

Bảng `projects` lưu thông tin dự án bao gồm tên hiển thị, mô tả, loại dự
án (`SOFTWARE`, `BUSINESS` hoặc `PERSONAL`), tên người sở hữu, và đặc biệt
là trường `key` viết hoa duy nhất kiểu Jira (ví dụ `TFM`, `MOB`). Trường
`key` này sau đó được dùng để sinh mã công việc dạng `TFM-101`, `TFM-102`
giúp người dùng dễ tham chiếu trong giao tiếp hằng ngày. Trường `owner_id`
lưu mã người sở hữu nhưng không có khóa ngoại đến bảng `users` ở User
Service — đây là tham chiếu logic xuyên service.

Bảng `project_members` đóng vai trò bảng nối nhiều-nhiều giữa người dùng
và dự án, kèm thêm thông tin về vai trò (role) của thành viên. Bảng có
ràng buộc `UNIQUE(project_id, user_id)` để tránh một người dùng được thêm
hai lần vào cùng một dự án. Trường `role` nhận một trong năm giá trị
`OWNER`, `ADMIN`, `EDITOR`, `COMMENTER` và `VIEWER`. Logic phân quyền xây
trên trường này được trình bày chi tiết ở mục 3.8.

Bảng `boards` và `lists` mô hình hóa cấu trúc Kanban. Mỗi bảng (board)
thuộc đúng một dự án, có thể tùy chỉnh tên, mô tả, mã màu nền. Mỗi cột
(list) thuộc đúng một bảng và mang ý nghĩa trạng thái công việc (ví dụ
"Cần làm", "Đang làm", "Đã xong"). Cả hai bảng đều có trường `position`
kiểu số nguyên để hỗ trợ chức năng sắp xếp bằng kéo-thả: khi người dùng
kéo một list sang vị trí mới, server cập nhật lại trường `position` cho
các list bị ảnh hưởng.

Bảng `sprints` lưu thông tin về các chu kỳ làm việc cố định (thường 1–2
tuần) theo phương pháp Agile/Scrum. Mỗi sprint có tên, mục tiêu, thời gian
bắt đầu và kết thúc cùng trạng thái nhận một trong ba giá trị `PLANNING`
(đang lên kế hoạch), `ACTIVE` (đang chạy) và `CLOSED` (đã đóng). Mặc dù
sprint được khai báo ở Project Service, mối quan hệ giữa sprint và công
việc lại được lưu ở Task Service thông qua cột `sprint_id` của bảng
`tasks` — đây là một ví dụ điển hình về cách hệ thống tách thuộc tính
nghiệp vụ về service có ranh giới ngữ nghĩa phù hợp nhất.

### 3.4.5. Cơ sở dữ liệu Task Service

Cơ sở dữ liệu `taskflow_task` là cơ sở dữ liệu phức tạp nhất trong hệ
thống, phản ánh vai trò trung tâm của công việc (task) trong toàn bộ
nghiệp vụ. Bảy bảng nghiệp vụ gồm `tasks`, `labels`, `task_label_mappings`,
`checklists`, `checklist_items`, `task_dependencies` và `task_watchers`
hoạt động cùng nhau để mô tả mọi khía cạnh của một công việc.

Bảng `tasks` là bảng trung tâm. Mỗi công việc có tiêu đề, mô tả (hỗ trợ
định dạng Markdown), người được giao, người tạo, hạn hoàn thành, độ ưu
tiên nhận giá trị `URGENT`, `HIGH`, `MEDIUM` hoặc `LOW`. Một điểm thiết
kế quan trọng là bảng `tasks` lưu **cùng lúc** bốn mã `project_id`,
`board_id`, `list_id` và `sprint_id`. Việc này thoạt nhìn có vẻ thừa
(`list_id` đã ngầm xác định `board_id` và `project_id` thông qua quan hệ ở
Project Service), nhưng thực chất là **denormalize có chủ đích**. Lý do là
truy vấn lọc công việc theo dự án, theo bảng hay theo sprint là thao tác
cực kỳ phổ biến trên giao diện người dùng; nếu phải gọi sang Project
Service mỗi lần để tra cứu cấu trúc cha-con, hiệu năng sẽ kém. Khi list
bị chuyển sang board khác (kịch bản hiếm), sự kiện `list.moved` sẽ kích
hoạt cập nhật đồng bộ `board_id` cho các công việc liên quan.

Để hỗ trợ tình huống nhiều người dùng cùng thao tác trên một công việc,
bảng `tasks` áp dụng cơ chế **khóa lạc quan** (optimistic locking) qua cột
`version` được đánh dấu bằng chú thích `@Version` của JPA. Mỗi lần cập
nhật, giá trị `version` tăng lên một đơn vị; nếu hai người cùng cố cập
nhật một công việc gần như đồng thời (ví dụ kéo cùng một công việc vào hai
cột khác nhau), người thứ hai sẽ nhận về mã lỗi HTTP 409 và phải nạp lại
trạng thái mới nhất.

Bảng `labels` lưu các nhãn dán có thể gán cho công việc (ví dụ "frontend",
"bug", "khẩn cấp"). Mỗi nhãn thuộc một dự án và có tên cùng mã màu. Bảng
nối nhiều-nhiều `task_label_mappings` cho phép một công việc gắn nhiều
nhãn và một nhãn áp dụng cho nhiều công việc. Quyết định đặt bảng `labels`
trong Task Service (thay vì Project Service) là để tránh phải gọi xuyên
service mỗi lần đọc chi tiết công việc — nhãn được hiển thị cùng với công
việc nên đặt trong cùng một cơ sở dữ liệu là hợp lý nhất.

Hai bảng `checklists` và `checklist_items` mô tả danh sách công việc con
bên trong một công việc lớn. Mỗi `checklist` có tiêu đề và chứa nhiều
`checklist_items`; mỗi item có nội dung văn bản, cờ `completed` và vị trí
sắp xếp. Người dùng có thể đánh dấu hoàn thành từng item để theo dõi tiến
độ chi tiết hơn ở cấp dưới của công việc.

Bảng `task_dependencies` mô tả mối quan hệ phụ thuộc giữa các công việc.
Mỗi bản ghi là một cạnh có hướng từ một công việc đến một công việc khác,
kèm loại quan hệ (`BLOCKS` nghĩa là phải xong việc kia trước, hoặc
`RELATES_TO` nghĩa là chỉ có liên quan). Một thách thức về tính đúng đắn ở
đây là phải đảm bảo đồ thị phụ thuộc không tạo chu trình, vì chu trình sẽ
khiến không công việc nào trong vòng có thể bắt đầu. Trước khi chèn một
quan hệ mới, Task Service chạy thuật toán **duyệt theo chiều sâu (DFS)**
trên đồ thị phụ thuộc hiện có; nếu phát hiện đường dẫn ngược về công việc
nguồn, hệ thống trả về mã lỗi `cycle_detected` và từ chối yêu cầu.

Cuối cùng, bảng `task_watchers` lưu các người dùng đã chọn theo dõi một
công việc cụ thể. Đây là khái niệm mượn từ Jira: thay vì chỉ người được
giao mới nhận thông báo, bất kỳ thành viên nào quan tâm cũng có thể đăng
ký theo dõi và nhận thông báo về mọi thay đổi. Bảng này có khóa chính kép
`(task_id, user_id)` cùng cột `watched_at` ghi thời điểm đăng ký.

Để hỗ trợ các truy vấn phổ biến, bảng `tasks` có bốn chỉ mục:
`idx_tasks_list` (lọc theo cột Kanban), `idx_tasks_assignee` (lọc theo
người được giao — phục vụ trang "Công việc của tôi"), `idx_tasks_project`
(lọc theo dự án) và `idx_tasks_due_date` (lọc theo hạn hoàn thành — phục
vụ chức năng quét công việc sắp đến hạn).

### 3.4.6. Cơ sở dữ liệu Collaboration Service

Cơ sở dữ liệu `taskflow_collab` chứa ba bảng phục vụ ba khía cạnh khác
nhau của hoạt động cộng tác: bình luận, tệp đính kèm và nhật ký hoạt động.

Bảng `comments` lưu các bình luận của người dùng trên một công việc cụ
thể. Mỗi bình luận có nội dung dạng văn bản Markdown, tác giả (`author_id`),
mã công việc (`task_id`) và một trường `parent_id` tùy chọn để hỗ trợ
trả lời bình luận một cấp. Đáng chú ý, bảng còn lưu thêm trường
`project_id` mặc dù về mặt logic có thể suy ra từ `task_id`. Lý do là khi
kiểm tra quyền truy cập bình luận, hệ thống cần biết `project_id` để gọi
sang Project Service tra cứu vai trò người dùng; nếu phải qua Task Service
trung gian sẽ thêm một bước mạng và tăng độ trễ. Việc lưu trực tiếp
`project_id` là một dạng denormalize có chủ đích, được đồng bộ qua sự
kiện khi công việc được di chuyển giữa dự án (mặc dù kịch bản này hiếm).

Bảng `attachments` lưu **metadata** của các tệp đính kèm, còn nội dung
file thực tế lưu trên hệ thống lưu trữ đối tượng MinIO (tương thích S3).
Mỗi bản ghi gồm tên file gốc, kiểu MIME, kích thước (giới hạn tối đa 25 MB)
và một trường `storage_key` lưu đường dẫn trên MinIO theo định dạng
`tasks/{taskId}/{uuid}.{ext}`. Quyết định tách metadata khỏi nội dung file
là tiêu chuẩn ngành: cơ sở dữ liệu quan hệ tối ưu cho truy vấn có cấu trúc,
trong khi hệ thống đối tượng tối ưu cho lưu trữ tệp lớn; ép cả hai vào
PostgreSQL sẽ dẫn đến phình to và làm chậm sao lưu.

Bảng `activity_logs` là bảng append-only, lưu toàn bộ hoạt động xảy ra
trên các đối tượng trong dự án để cung cấp dòng thời gian (timeline) cho
người dùng. Mỗi bản ghi mô tả "ai đã làm gì với đối tượng nào, vào lúc
nào". Các trường chính gồm `target_type` (`PROJECT`, `BOARD`, `LIST`,
`TASK`, `COMMENT`), `target_id`, `action` (`CREATED`, `UPDATED`,
`DELETED`, `MOVED`, `ASSIGNED`, ...), `actor_id` (người gây ra hành động)
và `occurred_at`. Đặc biệt, trường `payload` kiểu `jsonb` lưu trạng thái
chi tiết của thay đổi — ví dụ với hành động cập nhật, payload chứa cặp
giá trị trước-sau của các trường bị thay đổi. Việc dùng kiểu `jsonb`
cho phép linh hoạt với mọi loại thay đổi mà không cần biến bảng thành
"wide table" với hàng trăm cột không hữu dụng. Khi cần truy vấn theo nội
dung payload, có thể tạo chỉ mục GIN trên cột này.

Để hỗ trợ trang nhật ký hoạt động phải hiển thị nhanh các sự kiện gần đây
nhất của một dự án, bảng có chỉ mục
`idx_activity_project_time (project_id, occurred_at DESC)`. Khi cần xem
toàn bộ lịch sử của một đối tượng cụ thể, chỉ mục
`idx_activity_target (target_type, target_id)` hỗ trợ tra cứu hiệu quả.

### 3.4.7. Cơ sở dữ liệu Notification Service

Cơ sở dữ liệu `taskflow_notif` đơn giản hơn ba cơ sở dữ liệu trước, chỉ
gồm hai bảng. Bảng `notifications` lưu các thông báo dành cho người dùng,
mỗi bản ghi gồm người nhận (`user_id`), kiểu thông báo (nhận giá trị
trong tập hợp `TASK_ASSIGNED`, `TASK_DUE_SOON`, `COMMENT_ADDED`,
`MENTION`, `PROJECT_INVITED`, ...), tiêu đề, nội dung, liên kết sâu để
mở thẳng đến đối tượng liên quan trên giao diện, và trường `read_at`
ghi thời điểm người dùng đã đọc. Trường `read_at` được thiết kế dạng
nullable: giá trị `NULL` nghĩa là chưa đọc, giá trị có thực nghĩa là đã
đọc kèm thời điểm cụ thể. Cách này giúp truy vấn đếm số thông báo chưa
đọc (phục vụ huy hiệu badge ở góc giao diện) chỉ cần dùng điều kiện
`read_at IS NULL`. Chỉ mục `idx_notif_user_unread(user_id, read_at)`
được thiết kế đặc biệt theo dạng partial index để tăng tốc truy vấn này.
Trường `metadata` kiểu `jsonb` lưu thêm ngữ cảnh phụ trợ như mã công
việc, mã dự án, để giao diện hiển thị phong phú hơn mà không cần tra cứu
xuyên service.

Bảng `notification_preferences` lưu tùy chọn nhận thông báo của từng
người dùng. Bảng này dùng `user_id` làm khóa chính trực tiếp, không có
khóa thay thế — mỗi người dùng có đúng một bản ghi tùy chọn. Các trường
chính gồm `in_app_enabled` (bật/tắt thông báo trong ứng dụng),
`email_enabled` (bật/tắt thông báo qua thư điện tử) và
`per_type_settings` kiểu `jsonb` cho phép tùy chỉnh chi tiết theo từng
kiểu thông báo (ví dụ tắt thông báo "bình luận" nhưng giữ thông báo
"được giao việc").

### 3.4.8. Quan hệ logic xuyên service

Mặc dù năm cơ sở dữ liệu hoàn toàn độc lập về mặt vật lý, về mặt logic
chúng vẫn tham chiếu lẫn nhau thông qua các mã định danh. **Hình 3.4.1**
minh họa toàn bộ các quan hệ logic này dưới dạng sơ đồ tham chiếu.

*Hình 3.4.1. Sơ đồ tham chiếu logic xuyên service của hệ thống TaskFlow.
Mỗi mũi tên đứt nét biểu thị một tham chiếu logic không có khóa ngoại
vật lý: người dùng được tham chiếu bởi mã chủ sở hữu dự án, mã thành
viên, mã người được giao việc, mã tác giả bình luận, mã người tải lên
tệp và mã người nhận thông báo; dự án được tham chiếu bởi các công việc,
bình luận và nhật ký hoạt động thuộc về nó; công việc được tham chiếu
bởi các bình luận và tệp đính kèm của nó.*

Bảng dưới đây tổng hợp các cơ chế bảo đảm tính nhất quán cho từng loại
tham chiếu logic.

**Bảng 3.4.3. Cơ chế đảm bảo nhất quán cho tham chiếu xuyên service**

| Quan hệ logic | Cơ chế kiểm tra khi tạo | Cơ chế dọn dẹp khi xóa |
|---|---|---|
| `task → project` | Task Service gọi `/internal/projects/{id}/exists` | Sự kiện `project.deleted` → Task Service xóa cascade |
| `task → list` | Task Service gọi `/internal/lists/{id}/board` (vừa verify, vừa lấy `board_id`) | Sự kiện `list.deleted` → Task Service chuyển task sang list mặc định hoặc xóa |
| `comment → task` | Collaboration Service kiểm tra `task_id` qua Task Service | Sự kiện `task.deleted` → Collaboration xóa bình luận, tệp đính kèm |
| `notification → user` | Notification Service không verify (chấp nhận eventual) | Hiện không xóa thông báo cũ khi xóa user — chỉ ẩn |

Tóm lại, mô hình Database-per-Service trong TaskFlow đánh đổi sự thuận
tiện của khóa ngoại tập trung lấy lợi ích về khả năng deploy độc lập,
khả năng scale theo từng service, và phạm vi ảnh hưởng của sự cố được
khoanh vùng. Chi phí của sự đánh đổi này là cần triển khai cẩn thận hai
cơ chế kiểm tra khi tạo và dọn dẹp qua sự kiện — sẽ được mô tả lần lượt
ở các tiểu mục 3.5 và 3.6.

---

## 3.5. Thiết kế giao tiếp REST giữa các Service

### 3.5.1. Hai dạng giao tiếp trong hệ thống TaskFlow

Trong một hệ thống microservice, sự lựa chọn giữa giao tiếp đồng bộ và
giao tiếp bất đồng bộ có ảnh hưởng quyết định đến tính sẵn sàng, độ ổn
định và khả năng mở rộng của toàn hệ thống. Mỗi loại giao tiếp đều có
ưu điểm và nhược điểm riêng, do đó hệ thống TaskFlow sử dụng **cả hai
loại song song**, mỗi loại phù hợp với một dạng nghiệp vụ nhất định.

Giao tiếp đồng bộ được hiện thực qua RESTful API trên giao thức HTTP
giữa các service. Khi service A cần một thông tin để hoàn thành xử lý
yêu cầu hiện tại, nó gửi một yêu cầu HTTP đến service B và **chờ phản
hồi** trước khi tiếp tục. Mô hình này phù hợp khi cần kết quả trực tiếp,
như khi Task Service phải biết người dùng có phải thành viên dự án không
trước khi cho phép tạo công việc. Tuy nhiên, giao tiếp đồng bộ tạo ra
phụ thuộc tạm thời (temporal coupling): nếu service B đang chậm hoặc
không khả dụng, service A sẽ bị ảnh hưởng dây chuyền.

Giao tiếp bất đồng bộ được hiện thực qua kênh truyền tin RabbitMQ. Khi
một sự kiện xảy ra (ví dụ công việc mới được tạo), service A đẩy một
thông điệp vào hàng đợi rồi tiếp tục xử lý ngay lập tức mà không cần
chờ ai xử lý thông điệp đó. Các service khác quan tâm tới sự kiện sẽ
tiêu thụ thông điệp khi sẵn sàng. Mô hình này phù hợp với các nghiệp vụ
phụ trợ (ghi nhật ký, gửi thông báo, làm sạch dữ liệu), nơi sự chậm trễ
vài giây là chấp nhận được. Đổi lại, nó cung cấp tính tách rời rất cao:
service A không cần biết có bao nhiêu service tiêu thụ sự kiện, không
ảnh hưởng nếu service nào đó tạm thời down.

**Bảng 3.5.1. So sánh hai dạng giao tiếp trong TaskFlow**

| Tiêu chí | REST đồng bộ | RabbitMQ bất đồng bộ |
|---|---|---|
| Mô hình | Yêu cầu – Phản hồi | Phát hành – Đăng ký |
| Chờ kết quả | Có, blocking | Không, fire-and-forget |
| Phụ thuộc giữa hai bên | Temporal coupling | Loose coupling hoàn toàn |
| Phù hợp khi | Cần kết quả ngay (kiểm tra, query, validate) | Phát ra sự kiện để các service khác phản ứng |
| Tác động khi service đích down | Caller cũng bị lỗi nếu không có Circuit Breaker | Thông điệp tích trong hàng đợi, xử lý sau |
| Ví dụ trong TaskFlow | Task Service hỏi Project Service về vai trò | Task Service phát hành sự kiện `task.created` |

Trong mục 3.5 này, nhóm trình bày chi tiết về phần giao tiếp đồng bộ
qua REST; phần giao tiếp bất đồng bộ qua RabbitMQ sẽ được trình bày
trong mục 3.6.

### 3.5.2. Phân loại API trong hệ thống

Hệ thống TaskFlow có ba loại API REST với mục đích và phạm vi sử dụng
hoàn toàn khác nhau, thể hiện trong bảng dưới đây.

**Bảng 3.5.2. Các loại API trong hệ thống TaskFlow**

| Loại | Tiền tố URL | Đối tượng gọi | Đặc điểm |
|---|---|---|---|
| Public API | `/api/v1/...` | Client (FE, mobile) qua Gateway | Có wrapper `ApiResponse<T>`, kiểm tra JWT ở Gateway |
| Internal API | `/internal/...` | Service-to-service trong Docker network | Không có wrapper, Gateway chặn từ ngoài |
| WebSocket | `/ws/...` | Client kết nối realtime | Xác thực qua handshake |

Public API là giao diện chính của hệ thống dành cho ứng dụng client. Mọi
yêu cầu từ client đều phải đi qua API Gateway, được xác thực JWT, được
đo lường rate limit và được forward đến service phù hợp dựa trên prefix
URL. Public API tuân thủ chặt chẽ chuẩn REST và sử dụng wrapper phản
hồi chung `ApiResponse<T>` với bốn trường `status`, `message`, `data`,
`timestamp`.

Internal API là giao diện riêng giữa các service trong cùng mạng Docker.
Khác với Public API, Internal API không bị bao bọc bởi `ApiResponse<T>`
mà trả thẳng đối tượng DTO để service gọi không phải bóc tách thêm một
lớp. Toàn bộ endpoint có tiền tố `/internal/` đều bị API Gateway **chặn**
nếu yêu cầu đến từ bên ngoài Docker network, bảo đảm các endpoint nhạy
cảm này không bao giờ lộ ra Internet.

### 3.5.3. Các luồng giao tiếp REST nội bộ

Trong hệ thống TaskFlow, có bốn service phải gọi REST nội bộ đến nhau
trong quá trình xử lý nghiệp vụ. Bảng 3.5.3 liệt kê đầy đủ tám luồng
REST nội bộ này.

**Bảng 3.5.3. Các luồng REST nội bộ giữa các service**

| STT | Service gọi | Service đích | Endpoint nội bộ | Mục đích nghiệp vụ |
|---|---|---|---|---|
| 1 | Task | Project | `GET /internal/projects/{id}/members/{userId}/role` | Lấy vai trò của người dùng trong dự án để kiểm tra quyền |
| 2 | Task | Project | `GET /internal/lists/{id}/board` | Xác minh `list_id` hợp lệ và lấy về `board_id`, `project_id` |
| 3 | Task | Project | `GET /internal/projects/{id}/exists` | Kiểm tra dự án còn tồn tại |
| 4 | Collaboration | Project | `GET /internal/projects/{id}/members/{userId}/role` | Kiểm tra quyền bình luận và tải tệp đính kèm |
| 5 | Collaboration | Project | `GET /internal/projects/{id}/exists` | Xác minh dự án khi ghi nhật ký hoạt động |
| 6 | Notification | User | `GET /internal/users/{id}/contact` | Lấy địa chỉ thư điện tử và tên hiển thị để gửi thông báo |
| 7 | Notification | Project | `GET /internal/projects/{id}/members/{userId}/role` | Kiểm tra quyền subscribe WebSocket theo dõi bảng Kanban |
| 8 | Notification | User | `POST /internal/users/exists` | Xác minh hàng loạt mã người dùng khi xử lý `@mention` |

Có thể thấy ba luồng phổ biến nhất đều là kiểm tra vai trò người dùng
trong dự án. Điều này phản ánh đúng đặc thù của TaskFlow: hầu hết các
thao tác nghiệp vụ đều cần xác minh quyền theo cấp dự án, và logic này
được tập trung tại Project Service để bảo đảm nguồn dữ liệu duy nhất.
Các service khác không lưu bản sao thành viên dự án mà luôn hỏi sang
Project Service mỗi khi cần (có cache hỗ trợ, sẽ trình bày ở mục 3.5.5).

### 3.5.4. Cơ chế gọi qua Eureka và bảo vệ bằng Resilience4j

Một thách thức trong môi trường microservice là các service không có
địa chỉ IP cố định: chúng có thể được scale ra nhiều instance, được
khởi động lại, được điều phối sang máy khác. Để giải quyết vấn đề này,
hệ thống TaskFlow sử dụng **Spring Cloud Netflix Eureka** làm cơ chế
khám phá dịch vụ. Mỗi service khi khởi động sẽ tự đăng ký với Eureka
Server kèm theo địa chỉ và cổng của mình; định kỳ gửi heartbeat để xác
nhận còn sống. Khi service A muốn gọi service B, nó không gọi trực tiếp
bằng địa chỉ IP mà gọi qua **tên logic** đã đăng ký với Eureka (ví dụ
`taskflow-project`); Spring Cloud LoadBalancer sẽ tra cứu danh sách
instance hiện có, chọn một instance theo thuật toán round-robin và
chuyển hướng yêu cầu đến đó.

Tuy nhiên, ngay cả với Eureka, việc gọi REST giữa các service vẫn ẩn
chứa rủi ro: service đích có thể chậm, có thể trả lỗi tạm thời, có thể
hoàn toàn không khả dụng. Nếu không xử lý đúng, các lỗi này sẽ lan
truyền dây chuyền và làm sụp đổ toàn bộ hệ thống — kịch bản gọi là "lỗi
xếp tầng" (cascading failure). Để phòng ngừa, hệ thống TaskFlow trang
bị thư viện **Resilience4j** cho mọi WebClient gọi REST nội bộ, với bốn
cơ chế bảo vệ tổng hợp như trong bảng dưới đây.

**Bảng 3.5.4. Cấu hình Resilience4j cho REST gọi nội bộ**

| Cơ chế | Tham số | Ý nghĩa |
|---|---|---|
| Circuit Breaker | `slidingWindowSize = 10`, `failureRateThreshold = 50%`, `waitDurationInOpenState = 10s` | Khi tỉ lệ thất bại vượt 50% trong 10 yêu cầu gần nhất, ngắt mạch 10 giây — mọi gọi tiếp theo trả về fallback ngay lập tức mà không tốn tài nguyên |
| Timeout | 3 giây | Tránh thread caller bị treo vô hạn nếu service đích không phản hồi |
| Retry | 3 lần, backoff 0.5s / 1s / 2s | Tự động thử lại với các lỗi tạm thời (5xx, timeout); không retry với 4xx |
| Fallback | Trả `null` hoặc giá trị mặc định | Đảm bảo caller có phản hồi xác định ngay cả khi service đích hoàn toàn down |

Cơ chế **Circuit Breaker** (cầu dao điện) là cơ chế quan trọng nhất.
Nó vận hành theo ba trạng thái tương tự cầu dao trong gia đình. Trạng
thái CLOSED là trạng thái bình thường: mọi yêu cầu đều được chuyển đến
service đích. Khi tỉ lệ lỗi vượt ngưỡng, cầu dao chuyển sang trạng thái
OPEN: trong khoảng thời gian này, mọi yêu cầu đều bị từ chối ngay lập
tức mà không gọi đến service đích, tránh tạo thêm tải lên một service
đang gặp khó khăn. Sau khoảng thời gian chờ, cầu dao chuyển sang trạng
thái HALF_OPEN: cho phép một số yêu cầu thăm dò; nếu thành công thì
quay về CLOSED, nếu vẫn lỗi thì quay lại OPEN.

### 3.5.5. Chiến lược cache để giảm tải REST

Một quan sát quan trọng là **kiểm tra vai trò người dùng trong dự án**
là thao tác xảy ra ở gần như mỗi yêu cầu nghiệp vụ. Nếu cứ mỗi yêu cầu
lại gọi REST sang Project Service, tải sẽ rất lớn và Project Service
trở thành điểm thắt cổ chai của toàn hệ thống. Để giải quyết, hệ thống
sử dụng **Redis** làm lớp cache thông tin vai trò.

**Bảng 3.5.5. Các khóa cache Redis được dùng để giảm tải REST nội bộ**

| Khóa cache | Giá trị | Thời gian sống | Bị vô hiệu khi |
|---|---|---|---|
| `role:{projectId}:{userId}` | Chuỗi vai trò (`OWNER`, `ADMIN`, ..., hoặc `__NULL__`) | 5 phút | Sự kiện `project.member.added`, `project.member.removed`, `project.member.role_changed` |
| `proj:exists:{projectId}` | `true` / `false` | 10 phút | Sự kiện `project.created`, `project.deleted` |
| `user:contact:{userId}` | JSON `{email, name}` | 10 phút | Sự kiện `user.updated` |

Một chi tiết tinh tế là việc cache **giá trị âm**: khi tra cứu một
người dùng không phải thành viên của dự án, kết quả là `null`. Nếu
không cache giá trị này, mỗi yêu cầu của người dùng đó sẽ tiếp tục gọi
REST gây lãng phí. Do Redis không phân biệt được "khóa không tồn tại"
với "giá trị `null`", hệ thống dùng marker đặc biệt `__NULL__` để
biểu thị giá trị âm đã được cache.

Tuy nhiên, cache 5 phút cũng đồng nghĩa với việc một thay đổi vai trò
(ví dụ thành viên bị remove) sẽ không có hiệu lực ngay lập tức, lên tới
5 phút. Đây là rủi ro an ninh không thể chấp nhận. Để khắc phục, hệ
thống áp dụng cơ chế **invalidate qua sự kiện**: mỗi khi Project
Service thay đổi vai trò thành viên, nó phát hành sự kiện tương ứng
qua RabbitMQ. Mọi service tiêu thụ sự kiện đó (Task, Collaboration,
Notification) sẽ tự xóa khóa cache liên quan ngay lập tức. Nhờ đó, độ
trễ giữa thay đổi vai trò và sự áp dụng vai trò mới chỉ còn cỡ vài
trăm milliseconds — đủ nhanh để không gây vấn đề thực tế, đồng thời
vẫn giữ được lợi ích về hiệu năng của cache.

### 3.5.6. Mã truy vết xuyên service

Trong môi trường microservice, một yêu cầu của người dùng cuối có thể
đi qua bốn năm service khác nhau trước khi hoàn tất. Khi xảy ra lỗi,
việc gom log từ các service riêng lẻ lại với nhau để tái dựng dòng xử
lý là rất khó khăn nếu không có một định danh chung. Hệ thống TaskFlow
giải quyết vấn đề này bằng cách dùng **mã truy vết** (Trace ID).

Khi yêu cầu vào API Gateway, gateway kiểm tra xem yêu cầu có sẵn header
`X-Trace-Id` không. Nếu có (ví dụ do client gửi sẵn để phục vụ debug
liên client), giá trị này được giữ nguyên. Nếu không, gateway sinh một
UUID ngẫu nhiên và gắn vào header. Trong quá trình xử lý của mỗi
service, giá trị `trace_id` được lưu vào MDC (Mapped Diagnostic Context)
của Logback và tự động thêm vào mọi dòng log. Khi service A gọi REST
sang service B, mã này được truyền tiếp qua header. Khi service phát
hành sự kiện RabbitMQ, mã được nhúng vào envelope sự kiện và được
service tiêu thụ đọc lại vào MDC khi xử lý. Nhờ chuỗi truyền tiếp này,
một thao tác duy nhất của người dùng có thể được truy vết liên mạch qua
toàn bộ các service liên quan chỉ bằng một câu lệnh tìm kiếm log đơn
giản theo `trace_id`.

Tóm lại, giao tiếp REST trong TaskFlow được thiết kế với ba lớp bảo vệ
xếp chồng: Eureka cung cấp tính linh hoạt khi service di chuyển,
Resilience4j cung cấp khả năng chịu lỗi khi service đích gặp vấn đề,
và Redis cung cấp khả năng giảm tải khi tần suất gọi quá cao. Cùng với
mã truy vết để gỡ lỗi và internal API tách biệt với public API để bảo
mật, lớp giao tiếp REST hình thành nên nền tảng vững chắc cho phần kết
nối đồng bộ của hệ thống.

---

## 3.6. Thiết kế hệ thống Hàng đợi Thông điệp (RabbitMQ)

### 3.6.1. Kiến trúc RabbitMQ trong hệ thống

Như đã đề cập ở mục 3.5.1, hệ thống TaskFlow sử dụng kênh truyền tin
bất đồng bộ song song với REST để xử lý các tác vụ phụ trợ không yêu
cầu kết quả tức thì. RabbitMQ được chọn làm trung gian truyền tin do
nó có ba ưu điểm cốt yếu: hỗ trợ đầy đủ các mô hình định tuyến (direct,
fanout, topic, headers), độ tin cậy cao với các cơ chế persistent
message và publisher confirm, cùng giao diện quản trị trực quan giúp
gỡ lỗi và giám sát thuận tiện.

Trong TaskFlow, RabbitMQ đóng vai trò "xương sống của giao tiếp bất
đồng bộ". Khi một sự kiện nghiệp vụ xảy ra trong service nguồn, service
đó phát hành một thông điệp lên kênh trao đổi (exchange); thông điệp
được định tuyến vào một hoặc nhiều hàng đợi (queue) tùy theo khóa định
tuyến (routing key); cuối cùng, các service đăng ký với hàng đợi đó sẽ
tiêu thụ thông điệp khi sẵn sàng. Toàn bộ quy trình này diễn ra không
đồng bộ: service nguồn không cần biết có bao nhiêu service tiêu thụ
thông điệp, không cần đợi xử lý xong mới tiếp tục, và hoàn toàn không
bị ảnh hưởng nếu các service tiêu thụ tạm thời không khả dụng.

Hệ thống TaskFlow sử dụng đúng **một kênh trao đổi chính** tên là
`taskflow.events` cho toàn bộ sự kiện nghiệp vụ, kèm một kênh trao đổi
phụ `taskflow.events.dlx` dành riêng cho thông điệp lỗi (Dead Letter
Exchange). Có ba hàng đợi tiêu thụ chính, mỗi hàng đợi gắn với một
service cụ thể, được liệt kê trong bảng dưới đây.

**Bảng 3.6.1. Các hàng đợi chính và service tiêu thụ tương ứng**

| Tên hàng đợi | Service tiêu thụ | Các khóa định tuyến binding | Mục đích nghiệp vụ |
|---|---|---|---|
| `notification.q` | Notification Service | `task.*`, `project.member.*`, `comment.*`, `attachment.uploaded` | Gửi thông báo realtime + thư điện tử |
| `collab.activity.q` | Collaboration Service | `task.*`, `project.*`, `board.*`, `list.*`, `comment.*`, `attachment.*` | Ghi nhật ký hoạt động chi tiết |
| `task.cleanup.q` | Task Service | `project.deleted`, `list.deleted`, `board.deleted` | Dọn dẹp công việc khi đối tượng cha bị xóa |

*Hình 3.6.1. Sơ đồ topology RabbitMQ của hệ thống TaskFlow. Ba service
producer (Project, Task, Collaboration) đẩy sự kiện vào kênh trao đổi
trung tâm `taskflow.events`; ba hàng đợi tiêu thụ tương ứng nhận thông
điệp theo các pattern binding khác nhau và chuyển đến ba service
consumer (Notification, Collaboration, Task). Mỗi hàng đợi chính có
một hàng đợi chết (DLQ) tương ứng để chứa thông điệp xử lý thất bại.*

Mọi exchange, queue và message trong hệ thống đều được cấu hình với
thuộc tính `durable=true` và `delivery_mode=2`, nghĩa là chúng tồn tại
lâu dài trên đĩa của broker và sống sót qua các lần khởi động lại
RabbitMQ. Đây là yêu cầu bắt buộc đối với một hệ thống production:
không có thông điệp nghiệp vụ nào được phép biến mất chỉ vì broker
khởi động lại.

### 3.6.2. Thiết kế Exchange — Lý do chọn Topic Exchange

RabbitMQ cung cấp bốn loại kênh trao đổi với cơ chế định tuyến khác
nhau. Bảng dưới đây so sánh bốn loại này để giải thích lý do nhóm
chọn loại topic exchange cho TaskFlow.

**Bảng 3.6.2. So sánh các loại Exchange của RabbitMQ**

| Loại Exchange | Cơ chế định tuyến | Phù hợp khi |
|---|---|---|
| Direct | Khóa định tuyến phải khớp chính xác với binding key | Mỗi sự kiện đến đúng một loại consumer cố định |
| Fanout | Broadcast tới mọi hàng đợi gắn vào | Tất cả consumer đều cần nhận mọi sự kiện |
| Topic | Khóa định tuyến match pattern (sử dụng `*` và `#`) | Mỗi consumer chỉ muốn một subset sự kiện theo chủ đề |
| Headers | Match theo header thay vì khóa định tuyến | Trường hợp đặc biệt, hiếm dùng |

Quyết định chọn topic exchange dựa trên ba lý do.

Thứ nhất, các sự kiện trong TaskFlow có cấu trúc phân cấp tự nhiên
theo công thức `<lĩnh vực>.<thực thể>.<động từ>` (ví dụ
`task.created`, `project.member.added`, `comment.added`). Topic
exchange cho phép consumer subscribe theo mọi mức độ chi tiết: từ
"chỉ một sự kiện cụ thể" (`task.created`) cho tới "mọi sự kiện thuộc
một lĩnh vực" (`task.*`) hay thậm chí "mọi sự kiện trong hệ thống"
(`#`). Sự linh hoạt này được phản ánh trực tiếp trong bảng 3.6.1: ba
hàng đợi của ba service tiêu thụ ba tập sự kiện chồng nhau nhưng
không giống hệt nhau.

Thứ hai, topic exchange cho phép **thêm sự kiện mới mà không phải sửa
code consumer**. Ví dụ, nếu sau này nhóm thêm sự kiện
`task.archived`, consumer của Notification (binding với `task.*`) sẽ
**tự động** nhận được sự kiện này, không cần thay đổi code, không
cần redeploy. Đây là một đặc tính rất quan trọng cho khả năng mở rộng
của hệ thống.

Thứ ba, topic exchange tương thích tốt với khả năng thêm service mới
trong tương lai. Ví dụ, một Reporting Service mới có thể được thêm
vào hệ thống để tổng hợp số liệu thống kê; nó chỉ cần tạo một hàng
đợi của riêng mình và binding với `task.*` để nhận mọi sự kiện công
việc. Việc thêm service hoàn toàn không ảnh hưởng đến các service
hiện hữu.

### 3.6.3. Quy ước đặt khóa định tuyến

Để bảo đảm tính nhất quán và dễ đọc, khóa định tuyến của mọi sự kiện
trong TaskFlow tuân thủ công thức ba phần `<lĩnh vực>.<thực thể>.<động
từ>`. Tất cả các phần đều viết thường, phân cách bằng dấu chấm. Phần
thứ ba — động từ — luôn ở thể quá khứ phân từ để nhấn mạnh rằng sự
kiện mô tả một việc **đã** xảy ra trong quá khứ, không phải mệnh lệnh
yêu cầu thực hiện.

Quy ước này có hai lợi ích thực tế. Một mặt, nó giúp ngữ nghĩa rõ
ràng: đọc `project.member.added` ai cũng hiểu đây là sự kiện "thành
viên đã được thêm vào dự án", không thể hiểu nhầm thành hành động cần
thực hiện. Mặt khác, cấu trúc phân cấp tương thích trực tiếp với cú
pháp pattern matching của topic exchange (sử dụng `*` cho đúng một
mức và `#` cho nhiều mức), tạo điều kiện cho việc binding linh hoạt
như đã đề cập ở mục 3.6.2.

Bảng dưới đây liệt kê toàn bộ các sự kiện đang được sử dụng trong hệ
thống TaskFlow tính đến thời điểm này.

**Bảng 3.6.3. Danh mục đầy đủ các sự kiện trong hệ thống**

| Khóa định tuyến | Service phát hành | Service tiêu thụ | Mô tả ngữ nghĩa |
|---|---|---|---|
| `project.created` | Project | Collaboration, Notification | Dự án mới được tạo |
| `project.deleted` | Project | Task, Collaboration, Notification | Dự án bị xóa (cascade) |
| `project.member.added` | Project | Notification, Collaboration | Thành viên mới được thêm vào dự án |
| `project.member.removed` | Project | Notification, Collaboration | Thành viên bị xóa khỏi dự án |
| `project.member.role_changed` | Project | Notification, Collaboration | Vai trò của thành viên bị thay đổi |
| `board.created` | Project | Collaboration | Bảng Kanban mới |
| `board.deleted` | Project | Collaboration | Bảng Kanban bị xóa |
| `list.created` | Project | Collaboration | Cột Kanban mới |
| `list.deleted` | Project | Collaboration, Task | Cột Kanban bị xóa |
| `task.created` | Task | Notification, Collaboration | Công việc mới |
| `task.updated` | Task | Notification, Collaboration | Công việc bị sửa, kèm diff field |
| `task.moved` | Task | Notification, Collaboration | Công việc bị chuyển giữa các cột |
| `task.assigned` | Task | Notification, Collaboration | Người được giao công việc bị thay đổi |
| `task.deleted` | Task | Collaboration | Công việc bị xóa |
| `task.due_soon` | Task (scheduler) | Notification | Công việc sắp đến hạn (sự kiện hệ thống) |
| `task.overdue` | Task (scheduler) | Notification | Công việc đã quá hạn (sự kiện hệ thống) |
| `task.dependency.changed` | Task | Notification, Collaboration | Mối quan hệ phụ thuộc bị sửa |
| `comment.added` | Collaboration | Notification | Bình luận mới (kèm `@mention`) |
| `attachment.uploaded` | Collaboration | Notification | Tệp đính kèm mới được tải lên |

### 3.6.4. Cấu trúc Envelope chung của sự kiện

Để bảo đảm các service tiêu thụ không phải tự phân tích cấu trúc khác
nhau cho từng loại sự kiện, mọi sự kiện trong TaskFlow đều được bọc
trong một **vỏ envelope chung**, được định nghĩa trong thư viện dùng
chung `taskflow-events-contract` (dưới dạng một file JAR Maven nội
bộ). Mọi service phát hành và tiêu thụ đều phụ thuộc vào thư viện này,
bảo đảm cùng một định dạng tham chiếu duy nhất.

Vỏ envelope gồm bảy trường được mô tả trong bảng dưới đây.

**Bảng 3.6.4. Cấu trúc envelope chung của sự kiện**

| Trường | Kiểu | Bắt buộc | Vai trò |
|---|---|---|---|
| `event_id` | UUID v4 | Có | Định danh duy nhất, dùng để khử trùng lặp ở consumer |
| `event_type` | Chuỗi | Có | Trùng với khóa định tuyến, dùng để rẽ nhánh xử lý |
| `schema_version` | Số nguyên | Có | Tăng khi có breaking change, hỗ trợ chạy song song nhiều phiên bản |
| `occurred_at` | Số nguyên (epoch ms) | Có | Thời điểm sự kiện xảy ra thực sự |
| `actor_id` | Số nguyên | Có (trừ sự kiện hệ thống) | Mã người dùng gây ra hành động |
| `trace_id` | Chuỗi | Có | Mã truy vết được truyền từ service nguồn (xem mục 3.5.6) |
| `data` | Đối tượng | Có | Tải trọng nghiệp vụ cụ thể, khác nhau giữa các loại sự kiện |

Phần `data` thay đổi tùy theo loại sự kiện. Ví dụ với sự kiện
`task.created`, `data` chứa mã công việc, mã dự án, mã bảng, mã cột,
tiêu đề, người được giao, người tạo, hạn hoàn thành và độ ưu tiên. Với
sự kiện `task.updated`, `data` chứa mã công việc cùng đối tượng
`changes` mô tả các trường bị sửa kèm giá trị trước và sau — định dạng
này cho phép Collaboration ghi nhật ký chi tiết, đồng thời cho phép
Notification chỉ gửi thông báo khi các trường nhạy cảm thay đổi (hạn,
độ ưu tiên, tiêu đề).

### 3.6.5. Quy trình một sự kiện đầu cuối — Ví dụ Tạo công việc

Để hiểu rõ cách các thành phần phối hợp với nhau, mục này mô tả chi
tiết một quy trình điển hình: tình huống một người dùng tạo một công
việc mới có người được giao.

Bước 1: Người dùng A trên giao diện gửi yêu cầu POST đến `/api/v1/tasks`
qua API Gateway. Gateway xác thực JWT, gắn các header định danh và
chuyển tiếp yêu cầu đến Task Service.

Bước 2: Task Service nhận yêu cầu. Trước tiên, nó kiểm tra quyền của
người dùng A đối với dự án chứa cột mục tiêu (gọi REST đến Project
Service hoặc tra cache Redis). Nếu được phép, Task Service thực thi
thao tác chèn bản ghi mới vào bảng `tasks` trong cơ sở dữ liệu
`taskflow_task`.

Bước 3: Sau khi commit thành công, Task Service phát hành sự kiện
`task.created` lên kênh trao đổi `taskflow.events` với khóa định tuyến
là `task.created`. Việc phát hành được bọc trong khối try-catch
`AmqpException`: nếu RabbitMQ tạm thời không khả dụng, sự kiện không
được phát hành nhưng Task Service vẫn trả về kết quả 201 Created cho
người dùng A (đây là đánh đổi giữa tính khả dụng và độ trễ của nhật
ký phụ trợ).

Bước 4: Task Service trả về phản hồi HTTP 201 cho người dùng A. Toàn
bộ ba bước trên hoàn tất trong khoảng 50–100 mili giây trong môi
trường local.

Bước 5: Song song với việc người dùng A nhận phản hồi, RabbitMQ định
tuyến sự kiện vào hai hàng đợi: `notification.q` (vì khóa khớp pattern
`task.*` của hàng đợi Notification) và `collab.activity.q` (vì khóa
khớp pattern `task.*` của hàng đợi Collaboration).

Bước 6: Notification Service tiêu thụ sự kiện từ `notification.q`.
Nó tra cứu địa chỉ thư điện tử và tên hiển thị của người được giao
(qua REST đến User Service hoặc qua cache), tạo một bản ghi mới trong
bảng `notifications`, đẩy thông báo realtime qua WebSocket đến thiết
bị của người được giao, và gửi thư điện tử tóm tắt.

Bước 7: Collaboration Service tiêu thụ sự kiện từ `collab.activity.q`.
Nó tạo một bản ghi mới trong bảng `activity_logs` với `target_type =
TASK`, `action = CREATED`, `actor_id = <mã người tạo>` và `payload`
chứa snapshot ban đầu của công việc.

Toàn bộ phần xử lý phụ trợ (bước 5 đến bước 7) thường hoàn tất trong
vòng vài trăm mili giây kể từ thời điểm người dùng A nhận phản hồi,
nhưng quan trọng là nó **không cản trở** phản hồi đó. Nếu Notification
Service đang quá tải, Collaboration Service vẫn ghi nhật ký bình
thường. Nếu cả hai đều down, thông điệp vẫn được giữ trong hàng đợi
RabbitMQ và sẽ được xử lý khi service hồi phục — không có thông tin
nào bị mất.

### 3.6.6. Cơ chế đảm bảo độ tin cậy

Một hệ thống truyền tin chỉ có giá trị khi nó đảm bảo các thông điệp
nghiệp vụ không bị mất mát. Hệ thống TaskFlow áp dụng đồng thời tám
cơ chế tăng cường độ tin cậy, được tổng hợp trong bảng dưới đây.

**Bảng 3.6.5. Các cơ chế bảo đảm độ tin cậy của truyền tin**

| Cơ chế | Cấu hình | Ý nghĩa |
|---|---|---|
| Publisher confirm | `publisher-confirm-type: correlated` | Broker xác nhận đã nhận thông điệp; nếu không có ack, producer biết để retry |
| Mandatory flag | `mandatory: true` | Phát hiện sớm khi không có hàng đợi nào match khóa định tuyến |
| Persistent message | `delivery_mode = 2` | Thông điệp được lưu xuống đĩa, sống sót qua broker restart |
| Durable queue | `durable: true` | Hàng đợi tồn tại sau restart |
| Manual acknowledge | `acknowledge-mode: manual` | Consumer chỉ ack sau khi xử lý xong, tránh mất khi consumer crash giữa chừng |
| Retry tự động | 3 lần với backoff 1s / 5s / 15s | Tự động phục hồi từ các lỗi tạm thời |
| DLQ (Dead Letter Queue) | Mỗi hàng đợi có DLQ tương ứng | Thông điệp thất bại hoàn toàn không bị mất, được giữ lại để điều tra |
| Idempotent consumer | Khử trùng lặp theo `event_id` qua Redis (TTL 24 giờ) | Chấp nhận at-least-once delivery, đảm bảo xử lý đúng nghiệp vụ một lần |

Trong số các cơ chế trên, **idempotent consumer** là cơ chế đặc biệt
quan trọng cần làm rõ. RabbitMQ cung cấp ngữ nghĩa "ít nhất một lần"
(at-least-once delivery), nghĩa là một thông điệp có thể được giao
nhiều lần nếu consumer crash giữa chừng và không kịp gửi ack. Nếu
consumer không cẩn thận, một sự kiện `task.created` có thể bị xử lý
hai lần, dẫn đến hai bản ghi thông báo cho cùng một sự kiện. Để giải
quyết, mỗi consumer trước khi xử lý sẽ kiểm tra `event_id` của thông
điệp trong một Redis set; nếu đã có thì bỏ qua, nếu chưa thì xử lý và
ghi nhận `event_id` với thời gian sống 24 giờ. Nhờ đó, dù thông điệp
được giao nhiều lần, nghiệp vụ chỉ thực thi đúng một lần.

### 3.6.7. Quản lý phiên bản schema sự kiện

Một trong những thách thức của hệ thống dùng sự kiện là việc tiến hóa
schema theo thời gian. Khi nghiệp vụ thay đổi, ta cần thêm hoặc đổi
trường trong payload sự kiện, nhưng đồng thời không thể yêu cầu mọi
producer và consumer phải nâng cấp đồng bộ. Hệ thống TaskFlow tiếp
cận vấn đề này thông qua trường `schema_version` trong envelope kết
hợp với hai quy tắc đơn giản. Đối với thay đổi **tương thích ngược**
(chỉ thêm trường mới, không xóa hoặc đổi tên trường cũ), giữ nguyên
`schema_version`; consumer cũ vẫn parse được và đơn giản bỏ qua các
trường mới mà chúng không biết. Đối với thay đổi **không tương thích
ngược** (đổi tên, xóa, đổi kiểu trường), tăng `schema_version`;
producer phát hành song song cả hai phiên bản trong giai đoạn chuyển
tiếp; consumer được nâng cấp để hiểu cả hai phiên bản; sau khi tất cả
producer đã chuyển sang phiên bản mới, có thể loại bỏ phiên bản cũ.

---

## 3.7. Thiết kế WebSocket Realtime

### 3.7.1. Đặt vấn đề — Tại sao cần truyền thông realtime

Trong hệ thống TaskFlow có hai loại tương tác đòi hỏi cập nhật giao
diện gần như tức thì cho người dùng cuối, không thể chấp nhận độ trễ
nhiều giây.

Loại thứ nhất là **thông báo cá nhân**. Khi một người dùng được giao
một công việc, khi bình luận trên công việc đó đề cập đến họ, khi
công việc sắp đến hạn, người dùng cần biết ngay lập tức để phản ứng
kịp thời. Nếu thông báo bị trễ vài phút, trải nghiệm trở nên kém — đặc
biệt trong các quy trình làm việc nhóm theo phương pháp Agile yêu cầu
phản ứng nhanh.

Loại thứ hai là **đồng bộ trạng thái bảng Kanban giữa nhiều người dùng
cùng xem**. Đặc trưng của giao diện Kanban là nhiều thành viên thường
cùng mở một bảng để theo dõi tiến độ. Khi một người kéo một công việc
từ cột "Đang làm" sang cột "Đã xong", các thành viên khác cùng xem
bảng đó phải thấy thay đổi này gần như ngay lập tức; nếu không, họ có
thể vô tình thực hiện thao tác xung đột trên dữ liệu cũ.

Một cách tiếp cận đơn giản là dùng kỹ thuật **polling**: client định
kỳ gửi yêu cầu HTTP đến server (ví dụ mỗi năm giây) để hỏi xem có gì
mới không. Tuy nhiên cách này có ba nhược điểm nghiêm trọng. Thứ
nhất, phần lớn yêu cầu là vô ích (khoảng 95% trả về "không có gì
mới") — tạo gánh nặng không cần thiết lên gateway và cơ sở dữ liệu.
Thứ hai, độ trễ trung bình khoảng một nửa khoảng thời gian polling,
nghĩa là 2,5 giây nếu polling mỗi 5 giây — không đủ nhanh cho thao
tác kéo-thả. Thứ ba, polling không thực sự là realtime; tăng tần suất
polling để giảm độ trễ sẽ làm tải tăng tỉ lệ thuận, không bao giờ đạt
được trải nghiệm thực sự tức thì.

Do đó, hệ thống TaskFlow áp dụng **WebSocket** để xây kênh truyền tin
hai chiều bền vững giữa server và client, cho phép server chủ động đẩy
dữ liệu xuống client với độ trễ chỉ vài chục đến vài trăm mili giây.

### 3.7.2. Lựa chọn công nghệ — WebSocket kết hợp STOMP

WebSocket là một giao thức tầng ứng dụng do RFC 6455 chuẩn hóa, cho
phép thiết lập kênh truyền TCP song công sau một bước handshake ban
đầu sử dụng HTTP. Sau khi kết nối được thiết lập, cả server và client
có thể chủ động gửi tin nhắn cho nhau bất kỳ lúc nào, không cần
request-response. Tuy nhiên, WebSocket thuần chỉ định nghĩa kênh
truyền byte mà không quy định cách tổ chức tin nhắn, định danh kênh
hay xử lý đăng ký theo chủ đề. Để có những tính năng này, cần một
**sub-protocol** ở tầng trên.

Hệ thống TaskFlow sử dụng **STOMP** (Simple/Streaming Text-Oriented
Messaging Protocol) phiên bản 1.2 làm sub-protocol. STOMP cung cấp ba
khả năng quan trọng. Một là cú pháp **CONNECT/SUBSCRIBE/SEND** rõ
ràng, cho phép client đăng ký nhận tin từ một destination cụ thể.
Hai là khái niệm **destination** dạng đường dẫn (ví dụ
`/topic/board/11`), cho phép server tổ chức nhiều luồng tin riêng
biệt trên cùng một kết nối WebSocket. Ba là khả năng tích hợp tốt với
Spring Framework qua module `spring-websocket` và chú thích
`@EnableWebSocketMessageBroker`.

Về mặt phía client, hệ thống dùng thư viện `@stomp/stompjs` cho phần
giao tiếp STOMP cùng `sockjs-client` làm lớp tương thích phòng
trường hợp môi trường mạng của người dùng (như firewall doanh nghiệp)
chặn WebSocket thuần. SockJS sẽ tự động chuyển sang dùng kỹ thuật
long-polling nếu phát hiện không thể thiết lập WebSocket — bảo đảm
chức năng realtime vẫn hoạt động, dù với độ trễ cao hơn một chút.

Toàn bộ chức năng realtime trong TaskFlow được tập trung vào
**Notification Service**, không phân tán ra nhiều service. Lý do là
WebSocket yêu cầu duy trì trạng thái kết nối với mỗi client, và việc
quản lý tập trung giúp đơn giản hóa xử lý phiên (session management)
cũng như phân quyền truy cập kênh.

### 3.7.3. Cấu hình endpoint và message broker

Notification Service đăng ký **một endpoint WebSocket** duy nhất tại
đường dẫn `/ws/notifications`, với hai biến thể chạy song song: một
biến thể có hỗ trợ SockJS dành cho client cần fallback, và một biến
thể WebSocket thuần dành cho client ưu tiên hiệu năng tối đa. Cả hai
biến thể đều áp dụng cùng một interceptor xác thực JWT và cùng một
handler gán định danh người dùng cho phiên.

Phía server, Spring Boot được cấu hình với một **message broker
in-memory đơn giản** (sử dụng phương thức `enableSimpleBroker`) hỗ
trợ hai loại tiền tố destination. Tiền tố `/topic/` dành cho các kênh
broadcast (nhiều người cùng nhận), còn `/queue/` dành cho các kênh
private (một người duy nhất nhận). Bên cạnh đó, tiền tố `/app/` được
dùng cho tin nhắn từ client gửi lên server (mặc dù trong TaskFlow,
toàn bộ giao tiếp đều theo hướng server-to-client, client chỉ
subscribe chứ không gửi tin lên), còn tiền tố `/user/` được Spring sử
dụng để tự động ánh xạ destination private theo định danh người dùng.

Trong môi trường production thực tế, message broker in-memory có hạn
chế là không scale ngang được: nếu chạy nhiều instance Notification
Service, mỗi instance có một broker riêng và không biết về các kết
nối ở instance khác. Để khắc phục, có thể thay bằng broker bên ngoài
như RabbitMQ STOMP plugin hoặc Redis Pub/Sub — tuy nhiên việc này
nằm ngoài phạm vi đồ án.

### 3.7.4. Cơ chế xác thực qua handshake

WebSocket sau khi thiết lập không cho phép gắn header `Authorization`
vào từng frame như giao thức HTTP. Do đó, việc xác thực JWT chỉ được
thực hiện đúng **một lần** vào thời điểm handshake ban đầu — khi
client gửi yêu cầu HTTP nâng cấp giao thức.

Quy trình xác thực diễn ra như sau. Client gửi yêu cầu nâng cấp giao
thức đến `/ws/notifications` kèm token JWT, có thể đặt trong header
`Authorization` hoặc tham số chuỗi truy vấn `?token=...` (phương án
thứ hai dùng khi client không thể đặt header tùy chỉnh, như một số
thư viện SockJS cũ). Server có một `JwtHandshakeInterceptor` chạy
ngay trước khi handshake hoàn tất; interceptor đọc token, xác minh
chữ ký HS256 và kiểm tra hạn sử dụng. Nếu token hợp lệ, mã người dùng
được trích xuất và lưu vào thuộc tính phiên; sau đó
`UserHandshakeHandler` chuyển mã này thành đối tượng `Principal` mà
Spring dùng để định danh phiên về sau. Nếu token sai hoặc hết hạn,
interceptor trả về mã 401 và handshake bị từ chối.

Sau khi handshake thành công, kết nối WebSocket được thiết lập và
Spring duy trì ánh xạ giữa định danh người dùng và phiên này. Mọi
thao tác gửi tin private (qua `/user/{id}/...`) sau đó sẽ tự động
được định tuyến đến đúng phiên dựa trên ánh xạ này.

Một câu hỏi quan trọng là điều gì xảy ra nếu JWT hết hạn trong khi
kết nối đang mở. Trong TaskFlow, kết nối được cấu hình thời gian
sống bằng đúng thời gian còn lại của JWT; khi JWT hết hạn, server
chủ động đóng kết nối và client phải kết nối lại với token mới sau
khi refresh.

### 3.7.5. Hai loại destination chính

Hệ thống TaskFlow sử dụng đúng hai loại destination để phục vụ hai
loại tương tác realtime đã nêu ở mục 3.7.1, được tổng hợp trong bảng
sau.

**Bảng 3.7.1. Các destination WebSocket trong hệ thống**

| Destination | Loại | Đối tượng nhận | Mục đích |
|---|---|---|---|
| `/user/queue/notifications` | Private (Spring ánh xạ thành `/user/{userId}/queue/notifications`) | Một người dùng cụ thể | Thông báo cá nhân |
| `/topic/board/{boardId}` | Public broadcast trong nhóm | Mọi thành viên đang xem bảng | Đồng bộ thay đổi bảng Kanban |

Đối với thông báo cá nhân, server gọi phương thức gửi tin theo người
dùng của Spring (`convertAndSendToUser`) với hai tham số: định danh
người nhận và phần suffix `/queue/notifications`. Spring sẽ tự động
mở rộng tên đầy đủ và chỉ chuyển tin đến phiên WebSocket có
`Principal` khớp định danh người nhận. Nếu cùng người dùng đó đang
mở ứng dụng trên nhiều thiết bị (máy tính, điện thoại), Spring gửi
thông báo đến tất cả các phiên đang mở — đảm bảo người dùng nhận
thông báo trên thiết bị họ đang dùng.

Đối với đồng bộ bảng Kanban, server gửi tin tới destination
`/topic/board/{boardId}` và mọi client đã subscribe destination này
đều nhận được tin đồng thời. Tin có cấu trúc gồm một trường `type`
mô tả loại thay đổi (ví dụ `TASK_MOVED`, `TASK_CREATED`,
`TASK_UPDATED`) và một trường `data` chứa chi tiết. Phía client nhận
tin, đối chiếu với trạng thái hiện tại và cập nhật DOM tương ứng —
ví dụ với `TASK_MOVED`, client lấy thẻ công việc trong cột nguồn,
chuyển sang cột đích và đặt vào đúng vị trí.

Một vấn đề bảo mật cần xử lý ở đây là **ai được phép subscribe
`/topic/board/{boardId}`**. Nếu cho phép tự do, bất kỳ người dùng nào
biết mã bảng cũng có thể subscribe và xem trộm dữ liệu của dự án mà
họ không thuộc về. Để chống điều này, hệ thống có một
`StompChannelInterceptor` chạy trước mỗi frame SUBSCRIBE; interceptor
trích xuất mã bảng từ destination, gọi sang Project Service kiểm tra
người dùng có thuộc dự án chứa bảng đó không. Nếu không, frame
SUBSCRIBE bị từ chối với mã lỗi `forbidden`.

### 3.7.6. Quy trình đồng bộ bảng realtime đầu cuối

Để minh họa rõ cách các thành phần phối hợp, mục này mô tả chi tiết
quy trình khi người dùng A kéo một công việc trên bảng Kanban và
những người dùng khác đang xem cùng bảng đó thấy thay đổi.

Bước 1: Người dùng A trên trình duyệt thực hiện thao tác kéo-thả công
việc 100 từ cột "Đang làm" sang cột "Đã xong". JavaScript phía
client tạm thời cập nhật DOM để tạo cảm giác phản hồi tức thì, đồng
thời gửi yêu cầu POST đến `/api/v1/tasks/100/move` với thông tin mã
cột đích và vị trí mới.

Bước 2: API Gateway xác thực JWT, gắn các header định danh và
forward đến Task Service.

Bước 3: Task Service kiểm tra quyền của người dùng A (qua REST nội
bộ hoặc cache như đã trình bày ở mục 3.5), cập nhật bản ghi công việc
trong cơ sở dữ liệu (cùng với tăng `version` cho khóa lạc quan), và
phát hành sự kiện `task.moved` lên RabbitMQ.

Bước 4: Task Service trả về phản hồi HTTP 200 cho người dùng A.
Tổng thời gian từ thao tác kéo-thả đến phản hồi thường dưới 100 mili
giây.

Bước 5: RabbitMQ định tuyến sự kiện đến hàng đợi `notification.q`.
Notification Service tiêu thụ sự kiện, đọc mã bảng từ payload và gọi
phương thức broadcast với destination `/topic/board/{boardId}` và
payload chứa thông tin di chuyển.

Bước 6: Mọi client B, C, D đang subscribe `/topic/board/{boardId}`
(tức đang xem cùng bảng đó) nhận được tin gần như đồng thời. Mã
JavaScript phía client xử lý tin, cập nhật DOM và người dùng B, C, D
thấy thẻ công việc 100 di chuyển sang cột "Đã xong".

Tổng độ trễ từ khi A thả chuột đến khi B, C, D thấy thay đổi rơi
vào khoảng 150 đến 300 mili giây trong môi trường thử nghiệm local —
đủ nhanh để không gây cảm giác chậm trễ.

### 3.7.7. Các tình huống biên và cách xử lý

Việc duy trì kết nối WebSocket lâu dài đặt ra một số tình huống biên
mà thiết kế phải tính tới, được tổng hợp trong bảng dưới đây.

**Bảng 3.7.2. Các tình huống biên của truyền thông realtime**

| Tình huống | Xử lý của hệ thống |
|---|---|
| Người dùng đóng tab hoặc đăng xuất | Client gọi `client.deactivate()` để gửi DISCONNECT frame; server giải phóng tài nguyên phiên |
| Token JWT hết hạn khi đang kết nối | Server đóng kết nối có chủ ý; client tự refresh token và kết nối lại |
| Mất kết nối mạng tạm thời | Thư viện `@stomp/stompjs` tự động reconnect với backoff lũy thừa |
| Một người dùng mở ứng dụng trên nhiều thiết bị | Mỗi thiết bị là một phiên riêng; thông báo cá nhân được gửi đến tất cả các phiên |
| Người dùng bị xóa khỏi dự án khi đang xem bảng | Sự kiện `project.member.removed` kích hoạt server kiểm tra các phiên đang subscribe topic của bảng thuộc dự án; những phiên không còn quyền sẽ bị đóng |
| Nhiều người cùng xem một bảng đông đúc | Broadcast topic có chi phí tuyến tính theo số người, không phải vấn đề ở quy mô đồ án |
| Cần scale ngang Notification Service | Cần thay broker in-memory bằng broker bên ngoài (RabbitMQ STOMP plugin) — nằm ngoài phạm vi đồ án |

Tóm lại, lớp truyền thông realtime trong TaskFlow giải quyết được hai
bài toán quan trọng (thông báo cá nhân và đồng bộ bảng) với độ trễ
thấp và chi phí hợp lý. Việc tập trung tại Notification Service đơn
giản hóa quản lý phiên và bảo mật, trong khi việc xác thực qua
handshake bảo đảm chỉ người dùng hợp lệ mới truy cập được kênh. Mô
hình hai destination (private và public theo chủ đề) đủ linh hoạt cho
mọi nhu cầu realtime hiện tại của hệ thống.

---

## 3.8. Thiết kế Phân quyền (Authorization)

### 3.8.1. Mô hình phân quyền RBAC theo dự án

Trong hệ thống TaskFlow, mỗi người dùng có thể tham gia nhiều dự án
khác nhau với vai trò khác nhau. Một người có thể là Chủ sở hữu
(Owner) của dự án mà họ tự tạo, nhưng đồng thời chỉ là Người xem
(Viewer) trong một dự án khác mà họ được mời tham gia. Đặc điểm này
khác biệt rõ rệt với mô hình **RBAC truyền thống** vốn gán vai trò
cho người dùng ở cấp toàn hệ thống.

Để mô hình hóa đúng đặc thù này, hệ thống áp dụng biến thể **RBAC
theo dự án** (project-scoped RBAC). Vai trò không thuộc bản thân người
dùng, mà thuộc về **cặp (người dùng, dự án)**. Khi một thao tác cần
kiểm tra quyền, hệ thống xác định dự án liên quan đến tài nguyên,
sau đó tra cứu vai trò của người dùng trong dự án đó.

Mô hình này có ba ưu điểm. Thứ nhất, nó phù hợp tự nhiên với cách
thức tổ chức công việc thực tế — một người có thể vừa là leader của
nhóm này vừa là thành viên thường của nhóm khác. Thứ hai, việc tách
biệt vai trò theo dự án giúp giới hạn phạm vi ảnh hưởng của sai sót
phân quyền: nếu lỡ cấp vai trò sai cho ai đó trong một dự án, vấn
đề chỉ ảnh hưởng đến dự án đó. Thứ ba, nó cho phép dự án được chia
sẻ giữa các tổ chức khác nhau mà không cần đồng bộ vai trò toàn cục.

### 3.8.2. Hệ thống năm vai trò trong dự án và hai vai trò toàn cục

Hệ thống TaskFlow định nghĩa năm vai trò trong phạm vi mỗi dự án,
xếp theo thứ tự cấp độ từ cao xuống thấp như trong bảng dưới đây.

**Bảng 3.8.1. Năm vai trò trong phạm vi dự án**

| Vai trò | Tên tiếng Việt | Quyền chính |
|---|---|---|
| OWNER | Chủ sở hữu | Toàn quyền với dự án, bao gồm xóa dự án và chuyển quyền sở hữu cho người khác |
| ADMIN | Quản trị viên | Quản lý thành viên, bảng, sprint, nhãn; không xóa được dự án |
| EDITOR | Người chỉnh sửa | Tạo, sửa, xóa công việc; tạo bảng, cột; tải tệp đính kèm; quản lý phụ thuộc |
| COMMENTER | Người bình luận | Xem nội dung dự án và đăng bình luận; không sửa được công việc |
| VIEWER | Người xem | Chỉ đọc — không thực hiện được thao tác thay đổi nào |

Ngoài năm vai trò trong dự án, hệ thống còn hai vai trò toàn cục.
Vai trò GUEST chỉ người dùng đã đăng nhập nhưng **không** là thành
viên của dự án đang truy cập — họ được phép thực hiện các thao tác
không thuộc phạm vi dự án (như tạo dự án mới, xem hồ sơ cá nhân của
mình, quản lý thông báo cá nhân). Vai trò ANONYMOUS chỉ người dùng
chưa đăng nhập — chỉ được truy cập các API công khai như đăng ký,
đăng nhập, quên mật khẩu.

Năm vai trò trong dự án có quan hệ kế thừa theo thứ tự
`OWNER ⊃ ADMIN ⊃ EDITOR ⊃ COMMENTER ⊃ VIEWER`, nghĩa là mọi quyền của
vai trò thấp hơn đều được vai trò cao hơn bao hàm. Trong tài liệu
đặc tả, ký hiệu "EDITOR+" được sử dụng để chỉ tập hợp EDITOR cùng
mọi vai trò cao hơn, nghĩa là EDITOR, ADMIN, OWNER.

### 3.8.3. Cơ chế kiểm tra hai cấp

Quyền truy cập trong TaskFlow được kiểm tra ở hai cấp khác nhau trên
đường đi của yêu cầu, từ ngoài vào trong.

**Cấp một — Xác thực ở API Gateway**. Khi yêu cầu đến gateway, bộ lọc
JWT đầu tiên trích xuất token từ header `Authorization`, xác minh
chữ ký HS256 và kiểm tra hạn sử dụng. Nếu token hợp lệ, gateway giải
mã các thông tin trong payload (mã người dùng, tên đăng nhập, địa chỉ
thư điện tử) và gắn vào yêu cầu dưới dạng các header tùy chỉnh
`X-User-Id`, `X-Username`, `X-User-Email`. Các endpoint được đánh dấu
là PUBLIC (đăng ký, đăng nhập, quên mật khẩu) được bỏ qua bước này.

**Cấp hai — Phân quyền ở từng service**. Sau khi yêu cầu được forward
đến service đích, service đó đọc `X-User-Id` từ header, xác định mã
dự án chứa tài nguyên đang truy cập, gọi sang Project Service để lấy
vai trò của người dùng trong dự án đó (với hỗ trợ của cache Redis),
và so sánh vai trò thực tế với yêu cầu tối thiểu của endpoint. Nếu
vai trò thấp hơn yêu cầu, service trả về mã lỗi HTTP 403 kèm mã lỗi
nghiệp vụ `insufficient_role`. Nếu người dùng hoàn toàn không phải
thành viên của dự án, mã lỗi là `not_a_member`.

Một điểm thiết kế quan trọng là các service downstream (Task,
Collaboration, Notification) **không tự xác minh JWT** mà tin tưởng
hoàn toàn vào header do gateway gắn. Điều này đảm bảo bằng ba lớp
bảo vệ. Một, các service downstream không expose cổng ra ngoài
Docker network — chúng chỉ truy cập được từ trong cùng mạng container
nội bộ. Hai, gateway là điểm vào duy nhất cho mọi yêu cầu từ bên
ngoài. Ba, các header `X-User-*` từ client nếu có sẽ bị gateway xóa
sạch trước khi forward, rồi mới được gắn lại từ JWT đã xác minh —
nhờ đó client không thể giả mạo định danh.

### 3.8.4. Ma trận quyền chi tiết theo Service

Mục này tổng hợp ma trận quyền cho các endpoint trọng yếu của bốn
service nghiệp vụ chính, theo cách trình bày: dòng là endpoint, cột
là vai trò, ô đánh dấu chéo nghĩa là vai trò đó được phép thực hiện
endpoint.

**Bảng 3.8.2. Ma trận quyền cho các thao tác trên Project và Member**

| Endpoint | OWNER | ADMIN | EDITOR | COMMENTER | VIEWER | GUEST |
|---|---|---|---|---|---|---|
| POST `/projects` (tạo dự án mới) | – | – | – | – | – | ✓ (caller trở thành OWNER) |
| GET `/projects/{id}` | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| PUT `/projects/{id}` | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| DELETE `/projects/{id}` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| POST `/projects/{id}/transfer-ownership` | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| POST `/projects/{id}/members` (thêm thành viên) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| PATCH role thành viên | ✓ | ✓ (¹) | ✗ | ✗ | ✗ | ✗ |
| DELETE thành viên | ✓ | ✓ (²) | ✗ | ✗ | ✗ | ✗ |

(¹) ADMIN chỉ được đổi role giữa EDITOR, COMMENTER, VIEWER. Việc
nâng/hạ role lên ADMIN hoặc OWNER chỉ OWNER được phép. (²) ADMIN
không được xóa OWNER hay ADMIN khác. OWNER không thể tự xóa bản thân
khỏi dự án — phải chuyển quyền sở hữu trước.

**Bảng 3.8.3. Ma trận quyền cho các thao tác trên Board và List**

| Endpoint | OWNER | ADMIN | EDITOR | COMMENTER | VIEWER |
|---|---|---|---|---|---|
| POST board hoặc list | ✓ | ✓ | ✓ | ✗ | ✗ |
| PUT board hoặc list | ✓ | ✓ | ✓ | ✗ | ✗ |
| DELETE board | ✓ | ✓ | ✗ | ✗ | ✗ |
| DELETE list | ✓ | ✓ | ✓ | ✗ | ✗ |
| GET board hoặc list | ✓ | ✓ | ✓ | ✓ | ✓ |

**Bảng 3.8.4. Ma trận quyền cho các thao tác trên Task**

| Endpoint | OWNER | ADMIN | EDITOR | COMMENTER | VIEWER |
|---|---|---|---|---|---|
| POST `/tasks` (tạo công việc) | ✓ | ✓ | ✓ | ✗ | ✗ |
| GET `/tasks/{id}` | ✓ | ✓ | ✓ | ✓ | ✓ |
| PUT `/tasks/{id}` | ✓ | ✓ | ✓ | ✗ | ✗ |
| DELETE `/tasks/{id}` | ✓ | ✓ | ✓ (³) | ✗ | ✗ |
| POST `/tasks/{id}/move` | ✓ | ✓ | ✓ | ✗ | ✗ |
| POST `/tasks/{id}/watch` (theo dõi) | ✓ | ✓ | ✓ | ✓ | ✓ |

(³) EDITOR chỉ được xóa công việc do chính mình tạo hoặc được giao;
ADMIN và OWNER xóa được mọi công việc.

**Bảng 3.8.5. Ma trận quyền cho các thao tác trên Comment và
Attachment**

| Endpoint | OWNER | ADMIN | EDITOR | COMMENTER | VIEWER |
|---|---|---|---|---|---|
| POST comment | ✓ | ✓ | ✓ | ✓ | ✗ |
| GET comment | ✓ | ✓ | ✓ | ✓ | ✓ |
| PUT comment | author hoặc ADMIN+ | ✓ | author | author | ✗ |
| DELETE comment | author hoặc ADMIN+ | ✓ | author | author | ✗ |
| POST attachment (tải lên tệp) | ✓ | ✓ | ✓ | ✗ | ✗ |
| GET attachment (xem danh sách / tải về) | ✓ | ✓ | ✓ | ✓ | ✓ |
| DELETE attachment | uploader hoặc ADMIN+ | ✓ | uploader | ✗ | ✗ |

Có thể thấy điểm đặc biệt của Comment và Attachment là sự xuất hiện
của hai khái niệm "author" (tác giả bình luận) và "uploader" (người
tải lên tệp): người tạo ra tài nguyên luôn được quyền sửa hoặc xóa
tài nguyên đó, không phụ thuộc vai trò chung trong dự án. Cơ chế
này phản ánh đúng kỳ vọng về quyền tự chủ với nội dung mình tạo ra.

### 3.8.5. Triển khai kiểm tra phân quyền trong code

Để tránh việc kiểm tra phân quyền lặp lại nhiều lần ở mỗi endpoint
và dễ sai sót, mỗi service đóng gói logic kiểm tra trong một thành
phần dùng chung tên là `AuthorizationService`. Thành phần này cung
cấp hai phương thức cốt lõi.

Phương thức thứ nhất, `requireRole(projectId, userId, minRole)`, là
phương thức kiểm tra cơ bản. Nó tra cứu vai trò của người dùng trong
dự án thông qua REST đến Project Service (với hỗ trợ cache), sau đó
so sánh với vai trò tối thiểu yêu cầu. Nếu người dùng không phải
thành viên, phương thức ném ngoại lệ `ForbiddenException("not_a_member")`.
Nếu vai trò thấp hơn yêu cầu, ngoại lệ
`ForbiddenException("insufficient_role")` được ném ra. Ngoại lệ này
được bộ xử lý ngoại lệ chung của hệ thống chuyển thành phản hồi HTTP
403.

Phương thức thứ hai, `requireSelfOrAdmin(projectId, userId,
resourceOwnerId)`, được dùng cho các trường hợp mà người tạo ra tài
nguyên có quyền thao tác trên chính tài nguyên đó. Logic là: nếu
người dùng hiện tại trùng với người sở hữu tài nguyên thì cho phép
ngay; ngược lại, yêu cầu vai trò ADMIN trở lên. Ví dụ điển hình là
sửa và xóa bình luận: tác giả luôn được phép, còn người khác phải
là ADMIN hoặc OWNER.

Quy ước trong code là mọi phương thức controller hoặc facade thực
hiện thao tác có thay đổi dữ liệu đều phải gọi một trong hai phương
thức trên ngay ở dòng đầu tiên, trước khi đụng vào nghiệp vụ. Quy
ước này được áp dụng nhất quán giúp giảm rủi ro quên kiểm tra phân
quyền — một loại lỗi nghiêm trọng nhưng khó phát hiện bằng review
code thủ công.

### 3.8.6. Đồng bộ vai trò qua sự kiện

Như đã trình bày ở mục 3.5.5, vai trò được cache trong Redis với thời
gian sống 5 phút để giảm tải các cuộc gọi REST đến Project Service.
Tuy nhiên, riêng trong bối cảnh phân quyền, cache TTL 5 phút là quá
dài: nếu một thành viên bị xóa khỏi dự án do vi phạm, trong vòng 5
phút sau họ vẫn có thể thực hiện các thao tác như thể vẫn còn là
thành viên. Đây là rủi ro bảo mật không thể chấp nhận.

Giải pháp là cơ chế **vô hiệu hóa cache qua sự kiện**. Mỗi khi
Project Service thay đổi vai trò thành viên (thêm, xóa, đổi role),
nó phát hành sự kiện tương ứng (`project.member.added`,
`project.member.removed`, `project.member.role_changed`) qua
RabbitMQ. Cả ba service tiêu thụ là Task, Collaboration và
Notification đều có một consumer chuyên dụng cho các sự kiện này;
consumer chỉ làm một việc duy nhất là **xóa khóa cache liên quan**
trong Redis của service mình.

Nhờ đó, độ trễ giữa thay đổi vai trò ở Project Service và sự áp dụng
vai trò mới ở các service khác chỉ rơi vào khoảng 100 đến 500 mili
giây — về mặt thực tế là tức thì, đủ nhanh để loại bỏ rủi ro bảo
mật. Hệ thống vẫn giữ được lợi ích về hiệu năng của cache trong khi
không sacrifice tính kịp thời khi cần thiết.

### 3.8.7. Các tình huống biên trong phân quyền

Một số tình huống biên đặc biệt cần được thiết kế cẩn thận để hệ
thống xử lý đúng và nhất quán. Bảng 3.8.6 tổng hợp các tình huống
này cùng cách xử lý.

**Bảng 3.8.6. Các tình huống biên trong phân quyền và cách xử lý**

| Tình huống | Cách xử lý |
|---|---|
| OWNER muốn rời dự án mà không xóa dự án | Bị chặn — yêu cầu chuyển quyền sở hữu cho thành viên khác trước, rồi mới rời |
| Xóa dự án khi còn nhiều công việc, bình luận, tệp | Soft delete cascade qua sự kiện `project.deleted` — Task xóa công việc, Collaboration xóa bình luận và tệp đính kèm, Notification dọn thông báo liên quan |
| Hai người cùng kéo một công việc gần như đồng thời | Khóa lạc quan qua trường `version` — người gửi yêu cầu sau nhận HTTP 409 và phải tải lại |
| Vai trò bị hạ từ EDITOR xuống VIEWER khi đang mở form sửa | Lần submit tiếp theo nhận 403; giao diện chuyển sang chế độ chỉ đọc |
| Đang kết nối WebSocket khi bị xóa khỏi dự án | Sự kiện `project.member.removed` kích hoạt vô hiệu cache; lần gọi API tiếp theo nhận 403, đồng thời server đóng các phiên WebSocket liên quan |
| Reset password token bị tái sử dụng | Cờ `used = true` được đặt sau lần đầu thành công; mọi nỗ lực tiếp theo bị từ chối |
| JWT bị lộ | Refresh token được rotate (cấp mới mỗi lần dùng); chức năng đăng xuất xóa refresh token khỏi Redis nhằm thu hồi quyền truy cập |

### 3.8.8. Kiểm thử phân quyền

Phân quyền là một trong những phần dễ phát sinh lỗi nhất nhưng cũng
khó phát hiện nhất, do đa số lỗi không gây crash mà chỉ thể hiện qua
việc cho phép thao tác mà đáng lẽ phải cấm. Do đó, hệ thống yêu cầu
mỗi service phải có một lớp kiểm thử tích hợp chuyên về phân quyền
(thường đặt tên `AuthorizationIT.java`) cover đầy đủ ma trận quyền
đã thiết kế.

Tiêu chuẩn tối thiểu cho mỗi endpoint nghiệp vụ là bốn loại trường
hợp kiểm thử. Một, kịch bản thành công với vai trò thấp nhất được
phép (ví dụ test EDITOR tạo công việc thành công, không cần test
ADMIN và OWNER vì đã ⊃ EDITOR). Hai, kịch bản bị từ chối với vai trò
cao nhất không được phép (ví dụ test COMMENTER tạo công việc và
nhận về 403). Ba, kịch bản người dùng hoàn toàn không phải thành
viên (nhận 403 với mã lỗi `not_a_member`). Bốn, kịch bản đặc biệt
cho các thao tác chỉ OWNER mới được phép (ví dụ xóa dự án, chuyển
quyền sở hữu).

Bộ kiểm thử này được chạy tự động trong pipeline CI mỗi khi có thay
đổi code; bất kỳ kịch bản nào fail đều chặn merge — đảm bảo ma trận
quyền không bao giờ bị phá vỡ ngầm bởi các thay đổi code khác.

### 3.8.9. Tổng kết

Thiết kế phân quyền của TaskFlow kết hợp ba ý tưởng then chốt. Một là
mô hình RBAC theo dự án phù hợp với đặc thù người dùng có vai trò
khác nhau ở các dự án khác nhau. Hai là cơ chế hai cấp kiểm tra
(gateway xác thực, service phân quyền) phù hợp với kiến trúc
microservice — không lặp lại logic JWT ở mọi service nhưng vẫn bảo
đảm an toàn nhờ kiểm soát chặt mạng nội bộ. Ba là chiến lược cache
kết hợp invalidate qua sự kiện, vừa giải quyết được vấn đề hiệu năng
khi tần suất kiểm tra quyền rất cao, vừa không hi sinh tính kịp thời
khi vai trò thay đổi.

Cùng với năm tiểu mục đã trình bày, từ thiết kế cơ sở dữ liệu
(3.4), thiết kế giao tiếp REST (3.5), thiết kế kênh truyền tin bất
đồng bộ (3.6), thiết kế truyền thông realtime (3.7) đến thiết kế
phân quyền (3.8), Chương 3 đã trình bày trọn vẹn các quyết định
thiết kế cốt lõi cho phần hạ tầng kết nối và an ninh của hệ thống
TaskFlow. Chương tiếp theo sẽ đi vào chi tiết hiện thực hóa các
thiết kế này bằng công nghệ cụ thể.

---

> **Hết phần Hiếu phụ trách.** Năm tiểu mục với tổng độ dài ước tính
> 15–20 trang A4 khi định dạng lại trong Word với cỡ chữ 13 hoặc 14
> và giãn dòng 1.5.
