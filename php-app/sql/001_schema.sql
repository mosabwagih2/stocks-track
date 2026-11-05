-- Fémini Stock · MySQL / MariaDB schema (v1)
-- Works on MySQL 5.7+ / 8.x and MariaDB 10.3+ (InnoDB, utf8mb4). Plain SQL only:
-- no stored procedures, triggers or JSON column type, so it runs on shared cPanel hosting.
--
-- Design:
--  * `sync_state.rev` is one global revision counter. Every committed change set bumps it,
--    and every written row is stamped with the new revision (`rev`). Clients pull "rows with rev > N".
--  * `moves` is the stock ledger: append-only. The application user never needs UPDATE/DELETE on it
--    (see docs/DEPLOY.md for the optional hardening GRANT).
--  * Documents, orders, pickups and the small collections keep their full JSON in `payload`
--    next to a few indexed columns, so the browser app and the database speak the same shapes.

CREATE TABLE sync_state (
  id  TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  rev BIGINT UNSIGNED  NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO sync_state (id, rev) VALUES (1, 0);

CREATE TABLE roles (
  id    VARCHAR(32)  NOT NULL PRIMARY KEY,
  name  VARCHAR(80)  NOT NULL,
  perms TEXT         NOT NULL,                 -- JSON array of permission keys
  rev   BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE users (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  username   VARCHAR(60)  NOT NULL,
  name       VARCHAR(80)  NOT NULL,
  role_id    VARCHAR(32)  NOT NULL,
  pass_hash  VARCHAR(255) NULL,                -- password_hash(); NULL = cannot log in yet
  active     TINYINT(1)   NOT NULL DEFAULT 1,
  arch       TINYINT(1)   NOT NULL DEFAULT 0,  -- archived users are never deleted
  created_at DATETIME     NOT NULL,
  UNIQUE KEY uq_users_username (username),
  KEY ix_users_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_attempts (
  id       BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60)  NOT NULL,
  ip       VARCHAR(45)  NOT NULL,
  ok       TINYINT(1)   NOT NULL,
  at       DATETIME     NOT NULL,
  KEY ix_login_user (username, at),
  KEY ix_login_ip (ip, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Singleton values of the app state: settings, costs, catalog, counters, day lock ...
CREATE TABLE meta (
  k          VARCHAR(64)  NOT NULL PRIMARY KEY,
  v          LONGTEXT     NOT NULL,            -- JSON
  rev        BIGINT UNSIGNED NOT NULL,
  updated_by VARCHAR(32)  NULL,
  updated_at DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The stock ledger. Append-only.
CREATE TABLE moves (
  id       BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  t        BIGINT UNSIGNED NOT NULL,           -- client timestamp (ms)
  on_date  DATE            NOT NULL,
  type     VARCHAR(8)      NOT NULL,           -- RCV, SCN, RTN, ...
  doc      VARCHAR(40)     NOT NULL,           -- document number, e.g. SCN-0001
  sku      VARCHAR(40)     NOT NULL,
  q        INT             NOT NULL,
  from_loc VARCHAR(16)     NOT NULL,
  to_loc   VARCHAR(16)     NOT NULL,
  by_name  VARCHAR(80)     NOT NULL,
  note     VARCHAR(500)    NOT NULL DEFAULT '',
  rev      BIGINT UNSIGNED NOT NULL,
  KEY ix_moves_date (on_date),
  KEY ix_moves_sku (sku),
  KEY ix_moves_doc (doc),
  KEY ix_moves_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE docs (
  id      VARCHAR(40)  NOT NULL PRIMARY KEY,
  doc_no  VARCHAR(40)  NULL,
  type    VARCHAR(8)   NOT NULL,
  status  VARCHAR(16)  NOT NULL,
  on_date DATE         NULL,
  payload LONGTEXT     NOT NULL,
  gone    TINYINT(1)   NOT NULL DEFAULT 0,
  ord     BIGINT UNSIGNED NOT NULL,            -- creation order (the app relies on array order)
  rev     BIGINT UNSIGNED NOT NULL,
  KEY ix_docs_no (doc_no),
  KEY ix_docs_type (type, status),
  KEY ix_docs_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pickups (
  id      VARCHAR(40)  NOT NULL PRIMARY KEY,
  on_date DATE         NULL,
  payload LONGTEXT     NOT NULL,
  gone    TINYINT(1)   NOT NULL DEFAULT 0,
  ord     BIGINT UNSIGNED NOT NULL,
  rev     BIGINT UNSIGNED NOT NULL,
  KEY ix_pickups_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  ref       VARCHAR(40) NOT NULL PRIMARY KEY,
  waybill   VARCHAR(40) NULL,
  pickup_id VARCHAR(40) NULL,
  status    VARCHAR(8)  NOT NULL,              -- open, done, cx
  payload   LONGTEXT    NOT NULL,
  gone      TINYINT(1)  NOT NULL DEFAULT 0,
  ord       BIGINT UNSIGNED NOT NULL,
  rev       BIGINT UNSIGNED NOT NULL,
  KEY ix_orders_waybill (waybill),
  KEY ix_orders_pickup (pickup_id),
  KEY ix_orders_status (status),
  KEY ix_orders_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Small keyed collections: supply items and log, day closes, shops, employees, archives.
CREATE TABLE coll_rows (
  coll    VARCHAR(24)  NOT NULL,
  k       VARCHAR(80)  NOT NULL,
  payload LONGTEXT     NOT NULL,
  gone    TINYINT(1)   NOT NULL DEFAULT 0,
  ord     BIGINT UNSIGNED NOT NULL,
  rev     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (coll, k),
  KEY ix_coll_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity log. Append-only.
CREATE TABLE audit (
  id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  t       BIGINT UNSIGNED NOT NULL,
  by_name VARCHAR(80)  NOT NULL,
  msg     VARCHAR(500) NOT NULL,
  rev     BIGINT UNSIGNED NOT NULL,
  KEY ix_audit_rev (rev)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Uploaded files (original pickup / scan sheets, signed notes, photos). Bytes live on disk,
-- outside the web root; only the metadata is here.
CREATE TABLE files (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind        VARCHAR(16)  NOT NULL,           -- pickup, scan, signed_note, cancel, model_img, other
  owner_type  VARCHAR(20)  NOT NULL,           -- pickup, doc, order, model
  owner_id    VARCHAR(64)  NOT NULL,
  orig_name   VARCHAR(255) NOT NULL,
  mime        VARCHAR(100) NOT NULL,
  size_bytes  INT UNSIGNED NOT NULL,
  sha256      CHAR(64)     NOT NULL,
  path        VARCHAR(255) NOT NULL,           -- relative to the storage directory
  thumb_path  VARCHAR(255) NULL,
  uploaded_by VARCHAR(32)  NOT NULL,
  uploaded_at DATETIME     NOT NULL,
  KEY ix_files_owner (owner_type, owner_id),
  KEY ix_files_sha (sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
