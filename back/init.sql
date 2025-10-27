-- ======================================
-- データベース作成（未作成の場合）
-- ======================================
-- PostgreSQLでは既にデータベースが作成されているため、スキップ

-- ======================================
-- テーブル: users（任意：ユーザー管理用）
-- ======================================
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ======================================
-- テーブル: flower_slots（蕾ユニット：茎＋蕾部分）
-- ======================================
CREATE TABLE IF NOT EXISTS flower_slots (
  slot_id SERIAL PRIMARY KEY,
  grid_x INT NOT NULL,
  grid_y INT NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  UNIQUE (grid_x, grid_y)
);

-- ======================================
-- テーブル: flowers（ユーザーからアップロードされた「花」）
-- ======================================
CREATE TABLE IF NOT EXISTS flowers (
  id BIGSERIAL PRIMARY KEY,
  slot_id INT NOT NULL,
  user_id BIGINT NULL,
  image_path VARCHAR(256) NOT NULL,
  upload_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  qr_token VARCHAR(64) NOT NULL UNIQUE,
  FOREIGN KEY (slot_id) REFERENCES flower_slots(slot_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ======================================
-- インデックス追加（パフォーマンス配慮）
-- ======================================
CREATE INDEX IF NOT EXISTS idx_flowers_slot_id ON flowers(slot_id);
CREATE INDEX IF NOT EXISTS idx_flowers_qr_token ON flowers(qr_token);

-- ======================================
-- 初期データ投入：flower_slots にあらかじめ配置する蕾ユニット
-- 7列 × 4行（計28スロット）
-- ======================================
INSERT INTO flower_slots (grid_x, grid_y)
VALUES
  (1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(7,1),
  (1,2),(2,2),(3,2),(4,2),(5,2),(6,2),(7,2),
  (1,3),(2,3),(3,3),(4,3),(5,3),(6,3),(7,3),
  (1,4),(2,4),(3,4),(4,4),(5,4),(6,4),(7,4)
ON CONFLICT (grid_x, grid_y) DO NOTHING;
