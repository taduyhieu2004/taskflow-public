#!/usr/bin/env python3
"""
Seed 5 project demo cho TaskFlow Microservices.

Mỗi project có:
- 1 Main Board: To Do / In Progress / Review / Done
- 2-3 Sprint
- 12-18 task phân bổ qua 4 cột (gồm cột Review)
- 1 vài phụ thuộc giữa task

Khác nhau giữa các project: domain, tên, tasks.

Yêu cầu chạy: TẤT CẢ service đang UP + Gateway tại http://localhost:8080.
Trước khi chạy, các DB taskflow_project/_task/_collab/_notif đã được TRUNCATE.
"""

import json
import sys
import time
from urllib import error, request

BASE = "http://localhost:8080/api/v1"
DAY = 24 * 60 * 60 * 1000
NOW = int(time.time() * 1000)


# ───────────────────────────── HTTP helpers ─────────────────────────────


def call(method: str, path: str, body=None, token: str | None = None, silent: bool = False):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req) as r:
            return json.loads(r.read())
    except error.HTTPError as e:
        body = e.read().decode()
        try:
            j = json.loads(body)
            msg = j.get("message") or body
        except Exception:
            msg = body
        if not silent:
            print(f"  ✗ {method} {path} → {e.code}: {msg}")
        return None


def login(username: str, password: str) -> str | None:
    res = call("POST", "/auth/login",
               {"username": username, "password": password}, silent=True)
    return res["data"]["access_token"] if res and res.get("status") == 200 else None


def register_if_missing(username, email, password, full_name) -> str:
    token = login(username, password)
    if token:
        return token
    print(f"  + Tạo tài khoản {username}")
    call("POST", "/auth/register",
         {"username": username, "email": email,
          "password": password, "full_name": full_name})
    return login(username, password)


def me(token):
    return call("GET", "/users/me", token=token)["data"]


def update_profile(token, **fields):
    return call("PUT", "/users/me", fields, token=token)


# ──────────────────────────── Project helpers ────────────────────────────


def setup_main_board(project_id, token):
    """Lấy default board, thêm cột Review giữa Doing và Done. Trả về dict tên→id."""
    main_board_id = call("GET", f"/projects/{project_id}/boards",
                         token=token)["data"][0]["id"]
    call("POST", f"/boards/{main_board_id}/lists",
         {"name": "Review", "description": "Đã code xong, chờ review/QA",
          "position": 2}, token=token)
    board = call("GET", f"/boards/{main_board_id}", token=token)["data"]
    lists = {l["name"]: l["id"] for l in board["lists"]}
    return main_board_id, lists


def add_members(project_id, owner_tk, members):
    """members: list of (user_id, role)."""
    for uid, role in members:
        call("POST", f"/projects/{project_id}/members",
             {"user_id": uid, "role": role}, token=owner_tk)


def create_labels(project_id, owner_tk, specs):
    """specs: list of (name, hex_color). Trả về dict tên→id."""
    out = {}
    for name, color in specs:
        r = call("POST", f"/labels?project_id={project_id}",
                 {"name": name, "color": color}, token=owner_tk)
        if r:
            out[name] = r["data"]["id"]
    return out


def create_sprint(project_id, owner_tk, name, goal, start_off, end_off, status=None):
    r = call("POST", f"/projects/{project_id}/sprints",
             {"name": name, "goal": goal,
              "start_date": NOW + start_off * DAY,
              "end_date": NOW + end_off * DAY},
             token=owner_tk)
    sprint = r["data"]
    if status:
        call("PATCH", f"/sprints/{sprint['id']}",
             {"name": name, "goal": goal,
              "start_date": sprint["start_date"], "end_date": sprint["end_date"],
              "status": status},
             token=owner_tk)
    return sprint


def create_tasks(specs, labels, project_label_set):
    """
    specs: list of (sprint_id, list_id, token, assignee_id,
                    title, desc, priority, label_names, due_off_days)
    Trả về list các task đã tạo.
    """
    created = []
    for sprint_id, list_id, token, assignee_id, title, desc, priority, lbl_names, due_off in specs:
        label_ids = [labels[n] for n in lbl_names if n in labels]
        r = call("POST", "/tasks",
                 {"list_id": list_id, "title": title, "description": desc,
                  "priority": priority, "assignee_id": assignee_id,
                  "due_date": NOW + due_off * DAY,
                  "label_ids": label_ids, "sprint_id": sprint_id},
                 token=token)
        if r and r.get("data"):
            created.append(r["data"])
    return created


# ─────────────────────────────── Projects ───────────────────────────────


def seed_taskflow_microservices(hieu, tuong, hau, hieu_tk, tuong_tk, hau_tk):
    print("\n━━━ Project 1: TaskFlow Microservices ━━━")
    p = call("POST", "/projects",
             {"name": "TaskFlow Microservices", "key": "TFM",
              "type": "SOFTWARE",
              "description": "Đồ án Microservices — Trello/Jira hybrid, 5 service Spring Boot + React FE."},
             token=hieu_tk)["data"]
    pid = p["id"]
    add_members(pid, hieu_tk, [(tuong["id"], "EDITOR"), (hau["id"], "EDITOR")])

    bid, lists = setup_main_board(pid, hieu_tk)
    labels = create_labels(pid, hieu_tk, [
        ("Backend", "#3B82F6"), ("Frontend", "#A855F7"), ("DevOps", "#64748B"),
        ("Bug", "#EF4444"), ("Documentation", "#22C55E"),
    ])

    s1 = create_sprint(pid, hieu_tk, "S1 — Foundation",
                       "Eureka, Config, Gateway, hạ tầng.", -21, -8)
    s2 = create_sprint(pid, hieu_tk, "S2 — Core Domain",
                       "Project + Task + Dependency + Label.", -7, 7, status="ACTIVE")
    s3 = create_sprint(pid, hieu_tk, "S3 — Collab + Polish",
                       "Collab, Notification, FE realtime.", 8, 21)

    specs = [
        # S1 Done
        (s1["id"], lists["Done"], hieu_tk, hieu["id"], "Setup Eureka Discovery", "Service registry tại :8761.", "HIGH", ["DevOps"], -15),
        (s1["id"], lists["Done"], hieu_tk, hieu["id"], "Setup Spring Cloud Config", "Filesystem backend, port 8888.", "MEDIUM", ["DevOps"], -14),
        (s1["id"], lists["Done"], hieu_tk, hieu["id"], "Gateway routing + JWT filter", "Verify access token, gắn X-User-Id.", "HIGH", ["Backend"], -13),
        (s1["id"], lists["Done"], hieu_tk, hieu["id"], "User Service: auth flow", "Register/login/refresh, JJWT HS256.", "HIGH", ["Backend"], -12),
        (s1["id"], lists["Done"], hieu_tk, hieu["id"], "5 PostgreSQL DB + Liquibase", "Database-per-service.", "MEDIUM", ["DevOps"], -11),
        # S2 Done
        (s2["id"], lists["Done"], tuong_tk, tuong["id"], "Project Service CRUD", "Project + role OWNER khi tạo.", "HIGH", ["Backend"], -5),
        (s2["id"], lists["Done"], hau_tk, hau["id"], "Task Service CRUD", "CreateTask + optimistic lock version.", "HIGH", ["Backend"], -4),
        # S2 Review
        (s2["id"], lists["Review"], tuong_tk, tuong["id"], "Member CRUD + role authz", "ADMIN/EDITOR/COMMENTER/VIEWER, Redis cache. Cần review SecurityHeaderUtils.", "HIGH", ["Backend"], -2),
        (s2["id"], lists["Review"], hau_tk, hau["id"], "Task move + reorder position", "POST /tasks/{id}/move. PR sẵn sàng review.", "HIGH", ["Backend"], -1),
        (s2["id"], lists["Review"], hieu_tk, hieu["id"], "JWT refresh token rotation", "Cấp refresh token mới mỗi lần dùng. Đợi Tường review.", "HIGH", ["Backend"], 0),
        # S2 In Progress
        (s2["id"], lists["In Progress"], hau_tk, hau["id"], "Task dependency + cycle DFS", "BLOCKS / RELATES_TO, chặn vòng phụ thuộc.", "URGENT", ["Backend"], 2),
        (s2["id"], lists["In Progress"], hieu_tk, hieu["id"], "Kanban board dnd-kit", "Drag task giữa cột, reorder.", "HIGH", ["Frontend"], 4),
        # S2 To Do
        (s2["id"], lists["To Do"], hau_tk, hau["id"], "Checklist trong task", "Sub-tasks dạng checkbox.", "MEDIUM", ["Backend"], 6),
        (s2["id"], lists["To Do"], hieu_tk, hieu["id"], "Avatar upload qua MinIO", "POST /users/me/avatar multipart.", "MEDIUM", ["Backend", "Frontend"], 6),
        # S3 To Do
        (s3["id"], lists["To Do"], hieu_tk, hieu["id"], "Collab Service: Comment + Attachment", "MinIO + activity log.", "HIGH", ["Backend"], 12),
        (s3["id"], lists["To Do"], hieu_tk, hieu["id"], "Notification Service + WebSocket", "STOMP /user/queue/notifications.", "HIGH", ["Backend"], 13),
        (s3["id"], lists["To Do"], tuong_tk, tuong["id"], "Project archive + soft delete cascade", "Event project.deleted → cascade.", "MEDIUM", ["Backend"], 15),
        (s3["id"], lists["To Do"], hieu_tk, hieu["id"], "Postman collection + README", "Export collection.", "LOW", ["Documentation"], 19),
    ]
    create_tasks(specs, labels, set(labels.keys()))
    # Close S1
    call("PATCH", f"/sprints/{s1['id']}",
         {"name": s1["name"], "goal": s1["goal"],
          "start_date": s1["start_date"], "end_date": s1["end_date"],
          "status": "CLOSED"}, token=hieu_tk)
    print(f"  ✓ TFM (id={pid}): {len(specs)} task, 3 sprint")
    return pid


def seed_ecommerce(hieu, tuong, hau, hieu_tk, tuong_tk, hau_tk):
    print("\n━━━ Project 2: E-commerce Platform ━━━")
    p = call("POST", "/projects",
             {"name": "ShopFlow — E-commerce", "key": "SHOP",
              "type": "SOFTWARE",
              "description": "Nền tảng bán hàng online: catalog, cart, checkout, thanh toán, voucher."},
             token=tuong_tk)["data"]
    pid = p["id"]
    add_members(pid, tuong_tk, [(hieu["id"], "EDITOR"), (hau["id"], "EDITOR")])

    bid, lists = setup_main_board(pid, tuong_tk)
    labels = create_labels(pid, tuong_tk, [
        ("Catalog", "#F59E0B"), ("Cart", "#10B981"), ("Payment", "#EF4444"),
        ("UI", "#A855F7"), ("Performance", "#06B6D4"),
    ])
    s1 = create_sprint(pid, tuong_tk, "MVP Sprint", "Catalog + Cart cơ bản.", -14, -1, status="CLOSED")
    s2 = create_sprint(pid, tuong_tk, "Payment Sprint", "Tích hợp VNPay + Momo.", 0, 14, status="ACTIVE")

    specs = [
        (s1["id"], lists["Done"], hau_tk, hau["id"], "Product catalog CRUD", "API admin tạo/sửa sản phẩm.", "HIGH", ["Catalog"], -12),
        (s1["id"], lists["Done"], hau_tk, hau["id"], "Product search & filter", "Lọc theo category, giá, brand.", "HIGH", ["Catalog"], -10),
        (s1["id"], lists["Done"], hieu_tk, hieu["id"], "Trang chủ + danh mục", "Hero, featured products.", "MEDIUM", ["UI"], -8),
        (s1["id"], lists["Done"], hau_tk, hau["id"], "Add to cart + sync session", "Redis cache cart 7 ngày.", "HIGH", ["Cart"], -6),
        (s2["id"], lists["Review"], tuong_tk, tuong["id"], "VNPay integration", "Test sandbox xong, đợi PM review.", "URGENT", ["Payment"], -1),
        (s2["id"], lists["Review"], tuong_tk, tuong["id"], "Voucher engine", "Stacking rules, max discount cap. Đợi QA test edge case.", "HIGH", ["Payment"], 0),
        (s2["id"], lists["In Progress"], tuong_tk, tuong["id"], "Momo integration", "Tích hợp deeplink + webhook callback.", "HIGH", ["Payment"], 3),
        (s2["id"], lists["In Progress"], hieu_tk, hieu["id"], "Checkout flow 3 bước", "Address → Shipping → Payment.", "HIGH", ["UI", "Cart"], 5),
        (s2["id"], lists["To Do"], hau_tk, hau["id"], "Order history page", "Trang user xem đơn cũ.", "MEDIUM", ["UI"], 8),
        (s2["id"], lists["To Do"], tuong_tk, tuong["id"], "Email confirm order", "Template + SMTP queue.", "MEDIUM", ["Payment"], 9),
        (s2["id"], lists["To Do"], hau_tk, hau["id"], "Product image CDN", "Cloudflare R2, lazy load.", "LOW", ["Performance"], 12),
        (s2["id"], lists["To Do"], hieu_tk, hieu["id"], "Lighthouse audit & tối ưu", "Mục tiêu PageSpeed > 85.", "LOW", ["Performance", "UI"], 13),
    ]
    create_tasks(specs, labels, set(labels.keys()))
    print(f"  ✓ SHOP (id={pid}): {len(specs)} task, 2 sprint")
    return pid


def seed_banking(hieu, tuong, hau, hieu_tk, tuong_tk, hau_tk):
    print("\n━━━ Project 3: Mobile Banking App ━━━")
    p = call("POST", "/projects",
             {"name": "FinSecure — Mobile Banking", "key": "BANK",
              "type": "SOFTWARE",
              "description": "Ứng dụng ngân hàng số: chuyển tiền, QR pay, sổ tiết kiệm, đầu tư."},
             token=hau_tk)["data"]
    pid = p["id"]
    add_members(pid, hau_tk, [(hieu["id"], "ADMIN"), (tuong["id"], "EDITOR")])

    bid, lists = setup_main_board(pid, hau_tk)
    labels = create_labels(pid, hau_tk, [
        ("Security", "#DC2626"), ("Transfer", "#3B82F6"), ("UX", "#A855F7"),
        ("Compliance", "#F59E0B"), ("Bug", "#EF4444"),
    ])
    s1 = create_sprint(pid, hau_tk, "Security Hardening", "Penetration test + 2FA.", -10, 4, status="ACTIVE")
    s2 = create_sprint(pid, hau_tk, "QR Pay Sprint", "VietQR + dynamic QR.", 5, 18)

    specs = [
        (s1["id"], lists["Done"], hieu_tk, hieu["id"], "Biometric login (Face/Touch ID)", "Lưu key trong Keystore/Keychain.", "HIGH", ["Security"], -8),
        (s1["id"], lists["Done"], hau_tk, hau["id"], "2FA OTP qua SMS + TOTP", "Twilio + Google Authenticator.", "URGENT", ["Security"], -6),
        (s1["id"], lists["Review"], tuong_tk, tuong["id"], "Mã hóa AES-256 cho data tại rest", "Đợi external security audit review.", "URGENT", ["Security", "Compliance"], -2),
        (s1["id"], lists["Review"], hau_tk, hau["id"], "Audit log mọi transaction", "PCI-DSS yêu cầu. Đợi compliance officer ký.", "HIGH", ["Compliance"], -1),
        (s1["id"], lists["Review"], hieu_tk, hieu["id"], "Anti-phishing & device fingerprint", "Đợi PenTest team review.", "HIGH", ["Security"], 0),
        (s1["id"], lists["In Progress"], hau_tk, hau["id"], "Suspicious transaction alert", "ML-based, trigger SMS + email.", "HIGH", ["Security"], 2),
        (s1["id"], lists["In Progress"], tuong_tk, tuong["id"], "Session timeout + auto logout", "Inactive 5 phút.", "MEDIUM", ["Security", "UX"], 3),
        (s2["id"], lists["To Do"], hau_tk, hau["id"], "QR Pay scanner", "ML Kit Barcode Scanner.", "HIGH", ["Transfer"], 6),
        (s2["id"], lists["To Do"], hau_tk, hau["id"], "Dynamic QR generation", "Amount + merchant info embed.", "HIGH", ["Transfer"], 8),
        (s2["id"], lists["To Do"], hieu_tk, hieu["id"], "Lịch sử giao dịch UI", "Filter theo loại, ngày, số tiền.", "MEDIUM", ["UX"], 10),
        (s2["id"], lists["To Do"], tuong_tk, tuong["id"], "[BUG] Lỗi quy đổi tỷ giá ngoại tệ", "Round 4 chữ số sai, gây lệch 0.01% trong các giao dịch lớn.", "URGENT", ["Bug", "Transfer"], 4),
        (s2["id"], lists["To Do"], hau_tk, hau["id"], "Tính năng sổ tiết kiệm online", "Mở/đóng/rút online.", "MEDIUM", ["Transfer"], 14),
    ]
    create_tasks(specs, labels, set(labels.keys()))
    print(f"  ✓ BANK (id={pid}): {len(specs)} task, 2 sprint")
    return pid


def seed_crm(hieu, tuong, hau, hieu_tk, tuong_tk, hau_tk):
    print("\n━━━ Project 4: CRM Sales Pipeline ━━━")
    p = call("POST", "/projects",
             {"name": "SalesPipe — CRM", "key": "CRM",
              "type": "BUSINESS",
              "description": "Hệ thống quản lý sales pipeline: lead, deal, contact, báo cáo doanh thu."},
             token=hieu_tk)["data"]
    pid = p["id"]
    add_members(pid, hieu_tk, [(tuong["id"], "EDITOR"), (hau["id"], "COMMENTER")])

    bid, lists = setup_main_board(pid, hieu_tk)
    labels = create_labels(pid, hieu_tk, [
        ("Lead", "#10B981"), ("Deal", "#3B82F6"), ("Report", "#A855F7"),
        ("Integration", "#F59E0B"), ("Onboarding", "#EC4899"),
    ])
    s1 = create_sprint(pid, hieu_tk, "Lead Management", "Lead capture + scoring.", -7, 7, status="ACTIVE")

    specs = [
        (s1["id"], lists["Done"], tuong_tk, tuong["id"], "Lead capture form embed", "Iframe HTML cho landing pages.", "HIGH", ["Lead"], -5),
        (s1["id"], lists["Done"], tuong_tk, tuong["id"], "Lead scoring rule engine", "Score theo email domain, hành vi.", "HIGH", ["Lead"], -3),
        (s1["id"], lists["Review"], hieu_tk, hieu["id"], "Deal pipeline kanban view", "Drag deal giữa stages. Đợi sales team feedback.", "HIGH", ["Deal"], -1),
        (s1["id"], lists["Review"], tuong_tk, tuong["id"], "Email tracking pixel", "Track mở email, click link. Đợi privacy review.", "MEDIUM", ["Lead"], 0),
        (s1["id"], lists["In Progress"], hieu_tk, hieu["id"], "Contact deduplication", "Match theo email + phone.", "HIGH", ["Lead"], 2),
        (s1["id"], lists["In Progress"], tuong_tk, tuong["id"], "Báo cáo doanh thu theo tháng/quý", "Recharts + filter sales rep.", "MEDIUM", ["Report"], 4),
        (s1["id"], lists["To Do"], hieu_tk, hieu["id"], "Tích hợp Google Calendar cho meeting", "OAuth2 + sync 2 chiều.", "MEDIUM", ["Integration"], 6),
        (s1["id"], lists["To Do"], tuong_tk, tuong["id"], "Slack notification cho deal won/lost", "Webhook tới channel #sales.", "LOW", ["Integration"], 7),
        (s1["id"], lists["To Do"], hieu_tk, hieu["id"], "Onboarding tour cho user mới", "react-joyride 5 bước.", "LOW", ["Onboarding"], 9),
        (s1["id"], lists["To Do"], tuong_tk, tuong["id"], "Export báo cáo PDF + Excel", "Server-side rendering.", "LOW", ["Report"], 11),
    ]
    create_tasks(specs, labels, set(labels.keys()))
    print(f"  ✓ CRM (id={pid}): {len(specs)} task, 1 sprint")
    return pid


def seed_docs(hieu, tuong, hau, hieu_tk, tuong_tk, hau_tk):
    print("\n━━━ Project 5: Internal Docs Wiki ━━━")
    p = call("POST", "/projects",
             {"name": "DocSpace — Internal Wiki", "key": "DOC",
              "type": "PERSONAL",
              "description": "Wiki nội bộ công ty: process, onboarding, kiến thức kỹ thuật, FAQ."},
             token=hieu_tk)["data"]
    pid = p["id"]
    add_members(pid, hieu_tk, [(tuong["id"], "EDITOR"), (hau["id"], "EDITOR")])

    bid, lists = setup_main_board(pid, hieu_tk)
    labels = create_labels(pid, hieu_tk, [
        ("Onboarding", "#EC4899"), ("Engineering", "#3B82F6"), ("HR", "#10B981"),
        ("Process", "#F59E0B"), ("FAQ", "#A855F7"),
    ])
    s1 = create_sprint(pid, hieu_tk, "Q1 Documentation Push",
                       "Viết tài liệu Onboarding + Process.", -3, 11, status="ACTIVE")

    specs = [
        (s1["id"], lists["Done"], hau_tk, hau["id"], "Hướng dẫn cài dev environment", "Java 17, Node 20, Docker, IntelliJ.", "MEDIUM", ["Onboarding", "Engineering"], -1),
        (s1["id"], lists["Done"], tuong_tk, tuong["id"], "Quy trình code review", "Checklist + role reviewer.", "MEDIUM", ["Process", "Engineering"], 0),
        (s1["id"], lists["Review"], hieu_tk, hieu["id"], "Kiến trúc microservice tổng quan", "Sơ đồ hệ thống + flow. Đợi tech lead review.", "HIGH", ["Engineering"], 1),
        (s1["id"], lists["Review"], hau_tk, hau["id"], "Chính sách bảo mật mật khẩu", "Đợi HR + Security ký duyệt.", "HIGH", ["HR", "Process"], 2),
        (s1["id"], lists["In Progress"], tuong_tk, tuong["id"], "Hướng dẫn deploy production", "Step-by-step với screenshots.", "MEDIUM", ["Engineering", "Process"], 3),
        (s1["id"], lists["In Progress"], hieu_tk, hieu["id"], "FAQ về phúc lợi & nghỉ phép", "Phỏng vấn HR.", "LOW", ["HR", "FAQ"], 4),
        (s1["id"], lists["To Do"], hau_tk, hau["id"], "Tài liệu testing strategy", "Unit / Integration / E2E.", "MEDIUM", ["Engineering"], 6),
        (s1["id"], lists["To Do"], tuong_tk, tuong["id"], "Quy trình incident response", "On-call rotation + escalation.", "MEDIUM", ["Process"], 7),
        (s1["id"], lists["To Do"], hieu_tk, hieu["id"], "Onboarding video 30 phút", "Quay screen + voiceover.", "LOW", ["Onboarding"], 9),
        (s1["id"], lists["To Do"], hau_tk, hau["id"], "Glossary thuật ngữ kỹ thuật", "API, microservice, K8s,…", "LOW", ["FAQ", "Engineering"], 10),
    ]
    create_tasks(specs, labels, set(labels.keys()))
    print(f"  ✓ DOC (id={pid}): {len(specs)} task, 1 sprint")
    return pid


# ─────────────────────────────────── MAIN ───────────────────────────────────


def main():
    print("=== Login / ensure 3 thành viên ===")
    # Tạo nếu chưa có (an toàn cả khi DB user còn nguyên)
    register_if_missing("taduyhieu", "taduyhieu@taskflow.dev", "hieu112004", "Tạ Duy Hiếu")
    register_if_missing("levantuong", "levantuong@taskflow.dev", "tuong112004", "Lê Văn Tường")
    register_if_missing("buiconghau", "buiconghau@taskflow.dev", "hau112004", "Bùi Công Hậu")
    hieu_tk = login("taduyhieu", "hieu112004")
    tuong_tk = login("levantuong", "tuong112004")
    hau_tk = login("buiconghau", "hau112004")
    if not (hieu_tk and tuong_tk and hau_tk):
        sys.exit("Không login được 3 user. Kiểm tra User Service.")
    hieu = me(hieu_tk); tuong = me(tuong_tk); hau = me(hau_tk)
    print(f"  ✓ Hiếu id={hieu['id']}, Tường id={tuong['id']}, Hậu id={hau['id']}")

    update_profile(hieu_tk, full_name="Tạ Duy Hiếu", bio="Team lead — Gateway, User, Collab, Notification, FE.")
    update_profile(tuong_tk, full_name="Lê Văn Tường", bio="Project Service (Project, Board, List, Sprint, Member).")
    update_profile(hau_tk, full_name="Bùi Công Hậu", bio="Task Service (Task, move, dependency, label, checklist).")

    args = (hieu, tuong, hau, hieu_tk, tuong_tk, hau_tk)

    project_ids = []
    project_ids.append(seed_taskflow_microservices(*args))
    project_ids.append(seed_ecommerce(*args))
    project_ids.append(seed_banking(*args))
    project_ids.append(seed_crm(*args))
    project_ids.append(seed_docs(*args))

    print("\n=== Hoàn tất ===")
    print(f"  5 project tạo xong: ids={project_ids}")
    print(f"  Login:")
    print(f"    taduyhieu / hieu112004")
    print(f"    levantuong / tuong112004")
    print(f"    buiconghau / hau112004")
    print(f"  URL: http://localhost:5173/dashboard")


if __name__ == "__main__":
    main()
