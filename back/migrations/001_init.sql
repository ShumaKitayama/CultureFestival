-- PostgreSQL用の初期化スクリプト

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE api_key_role AS ENUM ('upload', 'display', 'ops');

CREATE TABLE IF NOT EXISTS api_keys (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    token CHAR(40) NOT NULL UNIQUE,
    role api_key_role NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    id BIGSERIAL PRIMARY KEY,
    path VARCHAR(255) NOT NULL,
    mime VARCHAR(64) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    bytes INTEGER NOT NULL,
    sha256 CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artworks (
    id BIGSERIAL PRIMARY KEY,
    asset_id BIGINT NOT NULL REFERENCES assets(id),
    user_id BIGINT REFERENCES users(id),
    title VARCHAR(120),
    tags JSONB,
    qr_token CHAR(48) NOT NULL UNIQUE,
    thumb_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenes (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE animation_kind AS ENUM ('pulsate', 'disperse', 'explode', 'spin_fight', 'stream_in');

CREATE TABLE IF NOT EXISTS scene_entities (
    id BIGSERIAL PRIMARY KEY,
    scene_id BIGINT NOT NULL REFERENCES scenes(id),
    artwork_id BIGINT NOT NULL REFERENCES artworks(id),
    init_x DOUBLE PRECISION NOT NULL,
    init_y DOUBLE PRECISION NOT NULL,
    init_vx DOUBLE PRECISION NOT NULL,
    init_vy DOUBLE PRECISION NOT NULL,
    init_angle DOUBLE PRECISION NOT NULL DEFAULT 0,
    init_scale DOUBLE PRECISION NOT NULL DEFAULT 1,
    animation_kind animation_kind NOT NULL,
    rng_seed BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS display_nodes (
    id BIGSERIAL PRIMARY KEY,
    scene_id BIGINT NOT NULL REFERENCES scenes(id),
    name VARCHAR(100) NOT NULL,
    viewport_x INTEGER NOT NULL,
    viewport_y INTEGER NOT NULL,
    viewport_w INTEGER NOT NULL,
    viewport_h INTEGER NOT NULL,
    scale DOUBLE PRECISION NOT NULL DEFAULT 1,
    pixel_width INTEGER NOT NULL,
    pixel_height INTEGER NOT NULL,
    device_key CHAR(40) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_artworks_asset ON artworks(asset_id);
CREATE INDEX IF NOT EXISTS idx_scene_entities_scene ON scene_entities(scene_id);
CREATE INDEX IF NOT EXISTS idx_display_nodes_scene ON display_nodes(scene_id);

-- 開発用のAPIキーを挿入
INSERT INTO api_keys (name, token, role) VALUES 
('upload_dev', 'upload_dev_key_12345', 'upload'),
('display_dev', 'display_dev_key_12345', 'display'),
('ops_dev', 'ops_dev_key_12345', 'ops')
ON CONFLICT (token) DO NOTHING;

-- デフォルトシーンを作成
INSERT INTO scenes (id, name, width, height) VALUES 
(1, 'メイン展示', 1920, 1080)
ON CONFLICT (id) DO NOTHING;