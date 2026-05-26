# SETUP — TaskFlow

Hai cách chạy hệ thống:

- **A. Docker Compose** (1 lệnh, khuyến nghị cho demo/đánh giá) — `§ 2`
- **B. Manual** (chạy từng service local cho dev, hot reload IDE) — `§ 3`

---

## 1. Yêu cầu

### A. Cho Docker Compose

| Tool | Version tối thiểu |
|---|---|
| Docker Engine | 24+ |
| Docker Compose | v2 (đi kèm Docker Desktop hoặc plugin) |
| RAM trống | ≥ 4 GB (8 service Java + Postgres/Redis/RabbitMQ/MinIO) |

### B. Cho Manual

| Tool | Version |
|---|---|
| Java | 17 (Corretto/Temurin) |
| Maven | 3.6.3+ |
| Node + npm | Node 20+, npm 10+ |
| Docker (chỉ hạ tầng) | 20+ |

---

## 2. Chạy bằng Docker Compose ⭐

```bash
cd /home/hieu/Documents/ms
cp .env.example .env           # chỉnh credentials / port nếu cần
docker compose up -d --build
```

Lệnh trên build 8 image (7 service Spring Boot + FE React) rồi start cùng 4 container hạ tầng (Postgres/Redis/RabbitMQ/MinIO). Lần đầu mất khoảng **6–10 phút** vì Maven download dependency; các lần sau dùng cache (`--mount=type=cache`) chỉ còn ~1–2 phút.

### File `.env`

Mọi credentials / port host / JWT secret / public URL đều nằm trong `.env`. `.env.example` là template để copy. File `.env` đã được `.gitignore` để không leak secret. Các giá trị quan trọng:

| Group | Biến |
|---|---|
| Postgres | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_HOST_PORT` |
| RabbitMQ | `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `RABBITMQ_HOST_PORT`, `RABBITMQ_MGMT_PORT` |
| MinIO | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_HOST_PORT`, `MINIO_CONSOLE_PORT`, `MINIO_ATTACHMENT_BUCKET`, `MINIO_AVATAR_BUCKET` |
| Redis / Eureka / Config / Gateway / FE | `REDIS_HOST_PORT`, `EUREKA_HOST_PORT`, `CONFIG_HOST_PORT`, `GATEWAY_HOST_PORT`, `FE_HOST_PORT` |
| JWT (đổi cho prod) | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_RESET_SECRET` |
| FE bundle | `PUBLIC_API_URL`, `PUBLIC_WS_URL` (browser dùng URL này gọi backend) |

### 2.1 Theo dõi

```bash
docker compose ps              # liệt kê container + healthcheck
docker compose logs -f gateway # xem log realtime 1 service
docker compose logs -f         # xem hết
```

Tất cả service đều có healthcheck. `docker compose ps` hiển thị `healthy` khi service đã sẵn sàng nhận request. `depends_on: condition: service_healthy` đảm bảo đúng thứ tự khởi động (Eureka → Config → User → Project → Task → Collab → Notification → Gateway → FE).

### 2.2 URL truy cập

| Cái gì | URL | Auth |
|---|---|---|
| **Frontend** | http://localhost:5173 | — |
| API Gateway | http://localhost:8080 | JWT |
| Eureka dashboard | http://localhost:8761 | — |
| RabbitMQ UI | http://localhost:15672 | guest / guest |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin |
| Postgres | localhost:5432 | postgres / postgres |

Swagger trực tiếp từng service:

| Service | URL |
|---|---|
| User | http://localhost:8081/swagger-ui.html (chỉ truy cập từ trong container — xem mục 5.2) |
| Project | http://localhost:8082/swagger-ui.html |
| Task | http://localhost:8083/swagger-ui.html |
| Collab | http://localhost:8084/swagger-ui.html |
| Notification | http://localhost:8085/swagger-ui.html |

> Lưu ý: docker-compose **chỉ expose port 8080 (Gateway) và 5173 (FE)** ra host. Các service backend (8081–8085) chỉ truy cập được trong network nội bộ `taskflow`. Nếu cần expose để xem Swagger, thêm block `ports` vào service tương ứng trong `docker-compose.yml`.

### 2.3 Tài khoản seed

Sau khi container `user-service` UP, có thể chạy script seed mẫu:

```bash
python3 seed_taskflow.py
```

Script tạo 3 user + 1 project + 3 sprint + 5 nhãn + 26 task. Đăng nhập FE với:

| Username | Password | Vai trò |
|---|---|---|
| `taduyhieu` | `hieu112004` | Team lead (Gateway/User/Collab/Notification/FE) |
| `levantuong` | `tuong112004` | Project Service |
| `buiconghau` | `hau112004` | Task Service |

Nếu chưa có `taduyhieu`, đăng ký qua FE hoặc cURL ở `§ 4.1` trước khi chạy seed.

### 2.4 Dừng & dọn

```bash
docker compose down              # tắt container, GIỮ volume (DB còn data)
docker compose down -v           # tắt + xoá volume → reset toàn bộ DB/MinIO/RabbitMQ
docker compose build --no-cache  # rebuild khi sửa code mà cache bị stale
```

### 2.5 Rebuild 1 service sau khi sửa code

```bash
docker compose up -d --build task-service
```

Compose tự dừng container cũ, build image mới, start lại. Các service phụ thuộc không bị restart.

---

## 3. Chạy manual (dev)

### 3.1 Hạ tầng

Có 2 cách:

**Cách 1:** chạy `docker compose up -d postgres redis rabbitmq minio` rồi build/run từng service Java ngoài Docker.

**Cách 2:** chạy lệnh `docker run` riêng:

```bash
# Postgres + tạo 5 DB
docker run -d --name taskflow-postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:15
for db in user project task collab notif; do
  docker exec taskflow-postgres psql -U postgres -c "CREATE DATABASE taskflow_$db;"
done

# Redis
docker run -d --name taskflow-redis -p 6379:6379 redis:7-alpine

# RabbitMQ
docker run -d --name taskflow-rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3.12-management

# MinIO
docker run -d --name taskflow-minio -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin \
  -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
```

### 3.2 Build shared lib + services

```bash
cd /home/hieu/Documents/ms/code

# Lần đầu (theo thứ tự — shared lib trước)
cd taskflow-events-contract && mvn clean install -DskipTests && cd ..
cd taskflow-common           && mvn clean install -DskipTests && cd ..
cd taskflow-eureka           && mvn clean package -DskipTests && cd ..
cd taskflow-config           && mvn clean package -DskipTests && cd ..
cd taskflow-gateway          && mvn clean package -DskipTests && cd ..
cd taskflow-user             && mvn clean package -DskipTests && cd ..
cd taskflow-project          && mvn clean package -DskipTests && cd ..
cd taskflow-task             && mvn clean package -DskipTests && cd ..
cd taskflow-collab           && mvn clean package -DskipTests && cd ..
cd taskflow-notification     && mvn clean package -DskipTests && cd ..
```

> Sau khi sửa `taskflow-common` hoặc `taskflow-events-contract`, phải `mvn install` lại rồi rebuild các service phụ thuộc.

### 3.3 Run order

```
Eureka → Config → User → Project → Task → Collab → Notification → Gateway
```

Mỗi tab terminal:

```bash
# Tab 1 — Eureka
cd code/taskflow-eureka && java -jar target/taskflow-eureka-0.1.0.jar

# Tab 2 — Config
cd code/taskflow-config && java -jar target/taskflow-config-0.1.0.jar

# Tab 3 — User Service
export POSTGRES_URL=jdbc:postgresql://localhost:5432/taskflow_user
export REDIS_PORT=6379
cd code/taskflow-user && java -jar target/taskflow-user-0.1.0.jar

# ... tương tự cho Project / Task / Collab / Notification ...

# Tab cuối — Gateway
cd code/taskflow-gateway && java -jar target/taskflow-gateway-0.1.0.jar
```

Đợi ~30s sau khi Gateway up để Eureka heartbeat đồng bộ trước khi gọi API.

### 3.4 Chạy FE

```bash
cd code/taskflow-fe
npm install
npm run dev   # mở http://localhost:5173
```

Nếu API Gateway chạy port khác `8080`, set:

```bash
VITE_API_URL=http://localhost:8080/api/v1 \
VITE_WS_URL=http://localhost:8080/ws/notifications \
npm run dev
```

---

## 4. Test API qua Gateway

### 4.1 Register + Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@example.com","password":"secret123","full_name":"Alice"}'

LOGIN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"secret123"}')

TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['access_token'])")
echo $TOKEN
```

### 4.2 Profile + Avatar upload

```bash
curl http://localhost:8080/api/v1/users/me -H "Authorization: Bearer $TOKEN"

curl -X POST http://localhost:8080/api/v1/users/me/avatar \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/avatar.png;type=image/png"
```

### 4.3 Project + Board + Sprint

```bash
# Tạo project (saga tự tạo board + 3 lists "To Do/In Progress/Done")
PROJECT=$(curl -s -X POST http://localhost:8080/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Demo","key":"DEMO","type":"SOFTWARE"}')
PID=$(echo "$PROJECT" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")

# Add member
curl -X POST http://localhost:8080/api/v1/projects/$PID/members \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"user_id":2,"role":"EDITOR"}'

# Sprint
curl -X POST http://localhost:8080/api/v1/projects/$PID/sprints \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Sprint 1","goal":"MVP","start_date":1777870000000,"end_date":1779080000000}'
```

### 4.4 Task

```bash
# Tạo task
curl -X POST http://localhost:8080/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"list_id":1,"title":"Setup login","priority":"HIGH","assignee_id":1,"sprint_id":1}'

# Move task
curl -X POST http://localhost:8080/api/v1/tasks/1/move \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"to_list_id":2}'

# Filter
curl "http://localhost:8080/api/v1/tasks?project_id=$PID&priority=HIGH" \
  -H "Authorization: Bearer $TOKEN"
```

### 4.5 Comment + Attachment

```bash
# Comment có @mention
curl -X POST http://localhost:8080/api/v1/tasks/1/comments \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"content":"Looks good @user2 please review"}'

# Upload attachment (multipart, max 25MB)
echo "hello" > /tmp/sample.txt
curl -X POST http://localhost:8080/api/v1/tasks/1/attachments \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/sample.txt;type=text/plain"
```

### 4.6 Notification + WebSocket

```bash
# REST
curl http://localhost:8080/api/v1/notifications -H "Authorization: Bearer $TOKEN"
curl http://localhost:8080/api/v1/notifications/unread-count -H "Authorization: Bearer $TOKEN"
curl -X PATCH http://localhost:8080/api/v1/notifications/read-all -H "Authorization: Bearer $TOKEN"

# STOMP destinations (FE đã wire sẵn — không cần test thủ công)
# /user/queue/notifications     ← private push
# /topic/board/{boardId}        ← broadcast cập nhật board
# URL connect: ws://localhost:8080/ws/notifications?token=$TOKEN
```

---

## 5. Mở rộng / debug

### 5.1 Reset DB (mất hết data)

```bash
docker compose down -v
docker compose up -d --build
```

### 5.2 Expose port debug của 1 service

Sửa `docker-compose.yml`, thêm block `ports` vào service muốn xem:

```yaml
  task-service:
    # ...
    ports:
      - "8083:8083"      # Swagger trực tiếp http://localhost:8083/swagger-ui.html
```

Rồi `docker compose up -d task-service`.

### 5.3 Exec shell vào container

```bash
docker compose exec gateway sh
docker compose exec postgres psql -U postgres -d taskflow_user
```

### 5.4 Xem event RabbitMQ

http://localhost:15672 (guest/guest) → Exchanges → `taskflow.events` → xem stats event đi qua.

---

## 6. Troubleshooting

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `docker compose up` báo port 5432/8080 đã chiếm | Process khác đang dùng port | Tắt service đó hoặc đổi port mapping trong `docker-compose.yml` |
| Container `taskflow-postgres` không có 5 DB | Volume cũ còn lại từ run trước | `docker compose down -v` rồi `up -d --build` |
| Build Maven trong Dockerfile rất lâu | Cache bị xoá (lần đầu hoặc `--no-cache`) | Bình thường ~6 phút, lần sau chỉ ~1 phút nhờ buildkit cache `/root/.m2` |
| `unhealthy: Configuration` ở healthcheck | Service mới start chưa kịp UP | Đợi 30–60s; xem `docker compose logs <service>` |
| Gateway 503 khi gọi `/api/v1/...` | Service backend chưa register Eureka | Đợi 30s sau khi Gateway healthy |
| Login OK, gọi `/users/me` qua Gateway 401 | Token cũ bị invalidate do single-session | Dùng token mới nhất từ lần login gần nhất |
| FE login thành công nhưng API tiếp theo 401 | `VITE_API_URL` build vào bundle sai host | Đảm bảo build với `VITE_API_URL=http://localhost:8080/api/v1` |
| `JWT signature does not match` | Secret key Gateway khác User service | 2 service cùng nhận `JWT_ACCESS_SECRET` qua env (docker-compose đã set sẵn) |
| Avatar upload OK nhưng ảnh không hiện | Gateway chưa restart sau khi thêm public path | `docker compose restart gateway` |
| Liquibase `validation failed` | Schema có changeset bị sửa sau khi chạy | Reset DB (`down -v`) hoặc thêm changeset mới |

---

