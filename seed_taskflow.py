#!/usr/bin/env python3
"""
Seed dữ liệu mẫu cho project TaskFlow Microservices.
- 3 thành viên: taduyhieu (đã có), Lê Văn Tường, Bùi Công Hậu
- 1 project, 1 board mặc định, 3 sprint, 5 nhãn
- ~25 task phân bổ theo chuyên môn

Chạy: python3 seed_taskflow.py
Yêu cầu: tất cả service đã up + Gateway tại http://localhost:8080
"""

import json
import sys
import time
from datetime import datetime, timedelta
from urllib import error, request

BASE = "http://localhost:8080/api/v1"
DAY = 24 * 60 * 60 * 1000
NOW = int(time.time() * 1000)


# ───────────────────────────── HTTP helpers ─────────────────────────────


def call(method: str, path: str, body=None, token: str | None = None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(url, data=data, headers=headers, method=method)
    try:
        with request.urlopen(req) as r:
            payload = json.loads(r.read())
            return payload
    except error.HTTPError as e:
        body = e.read().decode()
        try:
            j = json.loads(body)
            msg = j.get("message") or body
        except Exception:
            msg = body
        print(f"  ✗ {method} {path} → {e.code}: {msg}")
        return None


def login(username: str, password: str) -> str | None:
    res = call("POST", "/auth/login", {"username": username, "password": password})
    if not res or res.get("status") != 200:
        return None
    return res["data"]["access_token"]


def register_if_missing(username: str, email: str, password: str, full_name: str) -> str:
    """Trả về access_token. Nếu đã tồn tại thì login."""
    token = login(username, password)
    if token:
        print(f"  ↳ {username} đã có, dùng tài khoản cũ")
        return token
    print(f"  + Tạo tài khoản {username} ({full_name})")
    res = call(
        "POST",
        "/auth/register",
        {"username": username, "email": email, "password": password, "full_name": full_name},
    )
    if not res:
        sys.exit(f"Không tạo được tài khoản {username}")
    return login(username, password)


def me(token: str) -> dict:
    return call("GET", "/users/me", token=token)["data"]


def update_profile(token: str, **fields):
    return call("PUT", "/users/me", fields, token=token)


# ─────────────────────────────── Seeding ────────────────────────────────


def main():
    print("=== Login taduyhieu ===")
    hieu_tk = login("taduyhieu", "hieu112004")
    if not hieu_tk:
        sys.exit("Không login được taduyhieu/hieu112004. Kiểm tra lại tài khoản.")
    hieu = me(hieu_tk)
    print(f"  ✓ taduyhieu id={hieu['id']}")

    print("\n=== Đảm bảo 2 tài khoản còn lại ===")
    tuong_tk = register_if_missing(
        "levantuong", "levantuong@taskflow.dev", "tuong112004", "Lê Văn Tường"
    )
    hau_tk = register_if_missing(
        "buiconghau", "buiconghau@taskflow.dev", "hau112004", "Bùi Công Hậu"
    )
    tuong = me(tuong_tk)
    hau = me(hau_tk)
    print(f"  ✓ Tường id={tuong['id']}, Hậu id={hau['id']}")

    print("\n=== Cập nhật bio cho 3 thành viên ===")
    update_profile(hieu_tk, full_name="Tạ Duy Hiếu", bio="Team lead — Gateway, User Service, Collab, Notification, Frontend.")
    update_profile(tuong_tk, full_name="Lê Văn Tường", bio="Phụ trách Project Service (Project, Board, List, Sprint, Member).")
    update_profile(hau_tk, full_name="Bùi Công Hậu", bio="Phụ trách Task Service (Task CRUD, move, dependency, label, checklist).")

    print("\n=== Xoá project TF cũ (nếu có) ===")
    existing = call("GET", "/projects", token=hieu_tk)
    if existing and existing.get("data"):
        for p in existing["data"]:
            if p.get("key") == "TF":
                print(f"  - Xoá project cũ id={p['id']}")
                call("DELETE", f"/projects/{p['id']}", token=hieu_tk)
                # Đợi event cascade soft-delete xong (task/comment/attachment)
                time.sleep(2)

    print("\n=== Tạo project TaskFlow ===")
    project_res = call(
        "POST",
        "/projects",
        {
            "name": "TaskFlow Microservices",
            "key": "TF",
            "type": "SOFTWARE",
            "description": "Đồ án môn Microservices — Trello/Jira hybrid, 5 service Spring Boot + React FE.",
        },
        token=hieu_tk,
    )
    if not project_res:
        sys.exit("Không tạo được project (có thể key 'TF' đã tồn tại — xoá hoặc đổi key)")
    project_id = project_res["data"]["id"]
    print(f"  ✓ project_id={project_id}")

    # Boards
    boards = call("GET", f"/projects/{project_id}/boards", token=hieu_tk)["data"]
    board_id = boards[0]["id"]
    board = call("GET", f"/boards/{board_id}", token=hieu_tk)["data"]
    lists = sorted(board["lists"], key=lambda l: l["position"])
    todo_id, doing_id, done_id = lists[0]["id"], lists[1]["id"], lists[2]["id"]
    print(f"  ✓ board_id={board_id}, lists: TODO={todo_id}, DOING={doing_id}, DONE={done_id}")

    print("\n=== Thêm 2 thành viên vào project ===")
    call("POST", f"/projects/{project_id}/members", {"user_id": tuong["id"], "role": "EDITOR"}, token=hieu_tk)
    call("POST", f"/projects/{project_id}/members", {"user_id": hau["id"], "role": "EDITOR"}, token=hieu_tk)
    print("  ✓ Tường + Hậu role EDITOR")

    print("\n=== Tạo nhãn ===")
    label_specs = [
        ("Backend", "#3B82F6"),
        ("Frontend", "#A855F7"),
        ("DevOps", "#64748B"),
        ("Bug", "#EF4444"),
        ("Documentation", "#22C55E"),
    ]
    labels = {}
    for name, color in label_specs:
        r = call(
            "POST",
            f"/labels?project_id={project_id}",
            {"name": name, "color": color},
            token=hieu_tk,
        )
        labels[name] = r["data"]["id"]
        print(f"  ✓ label {name} id={labels[name]}")

    print("\n=== Tạo 3 sprint ===")
    sprint1 = call(
        "POST",
        f"/projects/{project_id}/sprints",
        {
            "name": "S1 — Foundation Layer",
            "goal": "Eureka, Config, Gateway, User Service, hạ tầng Postgres/Redis/RabbitMQ/MinIO.",
            "start_date": NOW - 21 * DAY,
            "end_date": NOW - 8 * DAY,
        },
        token=hieu_tk,
    )["data"]
    sprint2 = call(
        "POST",
        f"/projects/{project_id}/sprints",
        {
            "name": "S2 — Core Domain",
            "goal": "Hoàn thiện Project Service + Task Service, dependency cycle detection, label & checklist.",
            "start_date": NOW - 7 * DAY,
            "end_date": NOW + 7 * DAY,
        },
        token=hieu_tk,
    )["data"]
    sprint3 = call(
        "POST",
        f"/projects/{project_id}/sprints",
        {
            "name": "S3 — Collab + Polish",
            "goal": "Collab Service, Notification + WebSocket, FE realtime, tracing + rate limit.",
            "start_date": NOW + 8 * DAY,
            "end_date": NOW + 21 * DAY,
        },
        token=hieu_tk,
    )["data"]
    # Đưa S2 sang ACTIVE ngay. S1 sẽ đóng SAU khi tạo task (để snapshot có dữ liệu).
    call("PATCH", f"/sprints/{sprint2['id']}", {"name": sprint2["name"], "goal": sprint2["goal"], "start_date": sprint2["start_date"], "end_date": sprint2["end_date"], "status": "ACTIVE"}, token=hieu_tk)
    print(f"  ✓ S1={sprint1['id']} PLANNING (sẽ đóng sau), S2={sprint2['id']} ACTIVE, S3={sprint3['id']} PLANNING")

    # ─── Tasks ───
    print("\n=== Tạo tasks ===")
    task_specs = [
        # (sprint_id, list_id, assignee_token, assignee_id, title, description, priority, labels[], due_offset_days)
        # ── Sprint 1 — tất cả Done ──
        (sprint1["id"], done_id, hieu_tk, hieu["id"], "Setup Eureka Discovery Server", "Service registry tại :8761, đăng ký lazy load.", "HIGH", ["DevOps"], -15),
        (sprint1["id"], done_id, hieu_tk, hieu["id"], "Setup Spring Cloud Config Server", "Filesystem backend tại config-repo/, port 8888.", "MEDIUM", ["DevOps"], -14),
        (sprint1["id"], done_id, hieu_tk, hieu["id"], "Gateway routing + JWT filter", "Verify access token, gắn header X-User-Id cho downstream.", "HIGH", ["Backend"], -13),
        (sprint1["id"], done_id, hieu_tk, hieu["id"], "User Service: register/login/refresh", "JJWT HS256, 3 token types (ACCESS/REFRESH/RESET).", "HIGH", ["Backend"], -12),
        (sprint1["id"], done_id, hieu_tk, hieu["id"], "Khởi tạo 5 PostgreSQL database", "taskflow_user, _project, _task, _collab, _notif + Liquibase changesets.", "MEDIUM", ["DevOps"], -11),
        (sprint1["id"], done_id, hieu_tk, hieu["id"], "Docker compose: Redis + RabbitMQ + MinIO", "Redis 6397, RabbitMQ 5672/15672, MinIO 9000/9001.", "MEDIUM", ["DevOps"], -10),
        (sprint1["id"], done_id, hieu_tk, hieu["id"], "Shared lib: taskflow-common + events-contract", "BaseEntity, ApiResponse, exceptions, event DTOs.", "MEDIUM", ["Backend"], -9),

        # ── Sprint 2 — Done ──
        (sprint2["id"], done_id, tuong_tk, tuong["id"], "Project Service CRUD", "Project + UpdateProjectRequest + role OWNER khi tạo.", "HIGH", ["Backend"], -5),
        (sprint2["id"], done_id, tuong_tk, tuong["id"], "Saga: default Board + 3 Lists", "Tạo project kèm board mặc định, publish event BOARD_CREATED.", "HIGH", ["Backend"], -4),
        (sprint2["id"], done_id, tuong_tk, tuong["id"], "Member CRUD + role authz", "ADMIN/EDITOR/COMMENTER/VIEWER, Redis cache role 5 phút.", "HIGH", ["Backend"], -3),
        (sprint2["id"], done_id, hau_tk, hau["id"], "Task Service CRUD", "CreateTaskRequest, UpdateTaskRequest, optimistic lock version.", "HIGH", ["Backend"], -4),
        (sprint2["id"], done_id, hau_tk, hau["id"], "Task move giữa list + reorder position", "POST /tasks/{id}/move, recompute position.", "HIGH", ["Backend"], -2),

        # ── Sprint 2 — In Progress ──
        (sprint2["id"], doing_id, tuong_tk, tuong["id"], "Sprint CRUD + scheduled rollover", "@Scheduled cron 10 phút: PLANNING→ACTIVE, ACTIVE→CLOSED.", "HIGH", ["Backend"], 3),
        (sprint2["id"], doing_id, hau_tk, hau["id"], "Task dependency + cycle detection (DFS)", "BLOCKS / RELATES_TO, chặn tạo vòng phụ thuộc.", "URGENT", ["Backend"], 2),
        (sprint2["id"], doing_id, hieu_tk, hieu["id"], "Frontend Kanban board (dnd-kit)", "Drag task giữa cột, reorder cột, insert giữa.", "HIGH", ["Frontend"], 4),

        # ── Sprint 2 — To Do ──
        (sprint2["id"], todo_id, tuong_tk, tuong["id"], "Endpoint reorderLists + chèn list giữa", "PATCH /boards/{id}/lists/reorder, createList nhận position.", "MEDIUM", ["Backend"], 5),
        (sprint2["id"], todo_id, hau_tk, hau["id"], "Label CRUD + mapping task↔label", "Bảng task_label_mapping, dedup khi update.", "MEDIUM", ["Backend"], 5),
        (sprint2["id"], todo_id, hau_tk, hau["id"], "Checklist trong task", "Sub-tasks dạng checkbox, position, completed.", "MEDIUM", ["Backend"], 6),
        (sprint2["id"], todo_id, hieu_tk, hieu["id"], "Avatar upload qua MinIO", "POST /users/me/avatar (multipart), bucket taskflow-avatars.", "MEDIUM", ["Backend", "Frontend"], 6),

        # ── Sprint 3 — To Do ──
        (sprint3["id"], todo_id, hieu_tk, hieu["id"], "Collab Service: Comment + Attachment + Activity", "MinIO cho attachment, activity log via event consumer.", "HIGH", ["Backend"], 12),
        (sprint3["id"], todo_id, hieu_tk, hieu["id"], "Notification Service + WebSocket STOMP", "Topic /user/queue/notifications, dedup theo event_id.", "HIGH", ["Backend"], 13),
        (sprint3["id"], todo_id, hieu_tk, hieu["id"], "Toast UI cho realtime notification", "Click toast điều hướng tới task qua deep link ?task=.", "MEDIUM", ["Frontend"], 14),
        (sprint3["id"], todo_id, tuong_tk, tuong["id"], "Project archive + soft delete", "Soft delete cascade tới board/list/task/comment.", "MEDIUM", ["Backend"], 15),
        (sprint3["id"], todo_id, hau_tk, hau["id"], "Watcher cho task + auto-subscribe assignee", "Bảng task_watcher, publish event mỗi update.", "MEDIUM", ["Backend"], 15),
        (sprint3["id"], todo_id, hieu_tk, hieu["id"], "Postman collection + README per service", "Export collection, README có sequence Eureka→…→Gateway.", "LOW", ["Documentation"], 19),
    ]

    created_tasks = []
    for sprint_id, list_id, token, assignee_id, title, desc, priority, label_names, due_off in task_specs:
        label_ids = [labels[n] for n in label_names]
        due_date = NOW + due_off * DAY
        r = call(
            "POST",
            "/tasks",
            {
                "list_id": list_id,
                "title": title,
                "description": desc,
                "priority": priority,
                "assignee_id": assignee_id,
                "due_date": due_date,
                "label_ids": label_ids,
                "sprint_id": sprint_id,
            },
            token=token,
        )
        if r and r.get("data"):
            created_tasks.append(r["data"])
            print(f"  ✓ #{r['data']['id']:>3}  {title}")

    # ─── Đóng S1 → snapshot số liệu ───
    print("\n=== Đóng Sprint 1 (snapshot số liệu) ===")
    call(
        "PATCH",
        f"/sprints/{sprint1['id']}",
        {
            "name": sprint1["name"],
            "goal": sprint1["goal"],
            "start_date": sprint1["start_date"],
            "end_date": sprint1["end_date"],
            "status": "CLOSED",
        },
        token=hieu_tk,
    )
    print(f"  ✓ S1={sprint1['id']} CLOSED — snapshot lưu xong")

    # ─── Dependencies (vài quan hệ thực tế) ───
    print("\n=== Tạo phụ thuộc giữa task ===")

    def find_task(keyword: str):
        for t in created_tasks:
            if keyword.lower() in t["title"].lower():
                return t
        return None

    deps = [
        ("Member CRUD", "Project Service CRUD", "BLOCKS"),
        ("Saga: default Board", "Project Service CRUD", "BLOCKS"),
        ("Task move", "Task Service CRUD", "BLOCKS"),
        ("Frontend Kanban", "Task move", "RELATES_TO"),
        ("Toast UI", "Notification Service", "BLOCKS"),
        ("Watcher", "Notification Service", "RELATES_TO"),
    ]
    for src_kw, dep_kw, dtype in deps:
        src = find_task(src_kw)
        dep = find_task(dep_kw)
        if src and dep and src["id"] != dep["id"]:
            r = call(
                "POST",
                f"/tasks/{src['id']}/dependencies",
                {"depends_on_task_id": dep["id"], "type": dtype},
                token=hieu_tk,
            )
            if r:
                print(f"  ✓ #{src['id']} {dtype} #{dep['id']}")

    print("\n=== Xong! ===")
    print(f"  Project: TaskFlow Microservices (id={project_id}, key=TF)")
    print(f"  3 sprint, {len(created_tasks)} task, 5 nhãn")
    print(f"  Login: taduyhieu/hieu112004, levantuong/tuong112004, buiconghau/hau112004")
    print(f"  URL: http://localhost:5173/projects/{project_id}")


if __name__ == "__main__":
    main()
