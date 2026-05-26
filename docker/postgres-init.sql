-- Init script chạy 1 lần khi container Postgres lần đầu khởi tạo
-- (Docker postgres image tự execute mọi file .sql trong /docker-entrypoint-initdb.d)

CREATE DATABASE taskflow_user;
CREATE DATABASE taskflow_project;
CREATE DATABASE taskflow_task;
CREATE DATABASE taskflow_collab;
CREATE DATABASE taskflow_notif;
