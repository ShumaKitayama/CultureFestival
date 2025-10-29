# システム要件定義／設計ドキュメント

## 1. 背景

展示会向けシステム。参加者が Web 上で絵を描きアップロードすると、共通画面上の空間にその絵が表示される。その絵は画面上を浮遊するかのようにふわふわしながら移動し、画面端を壁として跳ね返る。また、さまざまなアニメーションを持つ。

## 2. 機能要件

### 2.1 ユーザー側機能

- ユーザーが Web ブラウザ上で絵を描く（既実装）
- 描いた絵を「アップロード」ボタンでサーバに送信

### 2.2 共通画面側機能（展示用）

- 空間に自由に絵が浮遊する。
- ブラウザの画面端を壁として跳ね返る動作をする。
- ５種類のアニメーションを持つ(大きくなったり小さくなったり,絵が散る,爆散,絵同士が高速回転して衝突しベイブレードみたいに戦う,画面端から流れてくる)
- アニメーションは一つの絵に対して 1 つで、前提として全ての絵はふわふわと移動しつつ、それとは別に上記アニメーションを一つ保有している。なお、ベイブレードは対となるペアが必要。

## 3. 非機能要件

- 同時アクセス数は低～中程度（数十～ 100 人想定）
- 実装は簡素に保つ（展示目的）
- 画像サイズ・データ転送量を抑制
- ローカル環境＋ ngrok 経由で外部アクセス可能な構成
- システム構成・運用手順を簡単に保つ（インストール・起動・会場設営）
- 必要最低限のセキュリティ（例：簡易アクセス制限）

## 4. 制約＆前提条件

- 描画部分の仮システムは既に実装済み（front ディレクトリ内）
- 展示会場ネットワークが不安定な可能性あり → オフラインもしくはローカル中心構成を想定
- 長期的なデータ保存・冗長化は必須ではない

設計方針（要点）
• 絵＝ Artwork、バイナリ＝ Asset で汎化
• 表示は Scene に配置された Entity として管理（物理・アニメの状態は揮発）
• 揮発状態は Redis、永続は MySQL ＋ローカル FS
• 複数ディスプレイは DisplayNode として Scene にアタッチ（座標と拡大率で壁面合成）
• 配信は WebSocket。アップロード → サーバ → 全 DisplayNode へ event broadcast
• 物理演算はクライアント側（各 DisplayNode）で tick。サーバは乱数シードと初期値のみ配布
• オフライン優先。ngrok は任意

アーキテクチャ
• フロント
• upload-app: 描画 → アップロード
• display-app: Scene クライアント（壁面合成可）
• ops-app: 簡易運用 UI（シーン切替、強制リセット、ミュートなど）
• バックエンド（Go/Gin）
• REST API（Artwork 登録、ダウンロード、Scene/Display 設定）
• WebSocket（rooms=scene_id）
• 画像保存: ローカル FS（/data/assets）。任意で S3 互換切替可能
• ストレージ
• MySQL: メタ
• Redis: 揮発（entity_state、rooms、pub/sub）
• 展示運用
• N 台の DisplayNode を scened room に参加。各自 viewport を持ち、壁面でタイル合成

ディレクトリ構成

/project-root
/backend
/cmd/server/main.go
/internal/api # REST/WS ハンドラ
/internal/app # usecase/service
/internal/domain # entities（Artwork, Scene, Display...）
/internal/repo # MySQL/Redis 実装
/internal/storage # asset FS/S3 adapter
/internal/ws # hub, rooms, auth
/migrations # SQL
/config # env, defaults
/frontend
/upload-app
/display-app
/ops-app
/common # 型定義・WS proto・util
/deploy
docker-compose.yml
.env.example
/data
/assets # 画像バイナリ

データモデル（ER 概要）
• users 任意
• assets 絵のバイナリと形式（png/jpg/webp/gif/svg）
• artworks メタ（作者、タイトル、タグ、サムネ、参照する asset_id）
• scenes 論理的な展示空間
• scene_entities Scene に配置される Artwork のインスタンス（初期位置・初期速度・アニメ種）
• display_nodes 物理ディスプレイ。解像度、座標、拡大率
• api_keys 簡易認証
• 揮発: entity_state:{scene_id}（Redis，位置・速度・回転・スケール）

アニメーション仕様
• 共通: ふわふわ移動＋壁反射。乱数漂流（Perlin 風）で微変動
• 追加アニメ種類（1 枚に 1 種） 1. pulsate: 拡大縮小 2. disperse: パーティクルに分解 → 再結合 3. explode: 爆散 → 消滅 or 再生 4. spin-fight: 近傍ペアを組み、角速度付与 → 衝突反発 5. stream-in: 画面端から流入
• 付与方法: scene_entities.animation_kind に列挙値

WebSocket イベント設計
• room: scene:{scene_id}
• メッセージ（JSON 型）
• server->client
• entity.add {entity_id, artwork_url, init: {x,y,vx,vy,angle,scale}, animation_kind, seed}
• entity.remove {entity_id, reason}
• scene.reset {hard:bool}
• display.config {viewport:{x,y,width,height,scale}}
• clock.sync {t0, tick_ms}
• client->server
• display.hello {display_key, scene_id, caps:{w,h,px_ratio}}
• state.report {entity_id, x,y,vx,vy,angle,scale,ts} ※任意（観測ベース）
• tick は各 DisplayNode がローカルで実行。clock.sync でドリフト抑制

API 仕様

エンドポイント メソッド 説明
/api/artworks POST 画像アップロード＋ Artwork 登録。戻り: artwork_id, asset_url, thumb_url
/api/artworks/{id} GET メタ取得
/download/{token} GET QR トークンで原本ダウンロード
/api/scenes POST/GET シーン作成/一覧
/api/scenes/{id}/entities POST Scene に Artwork を実体化。初期座標/速度/アニメを指定
/api/scenes/{id}/reset POST シーン初期化（揮発状態を Redis から削除）
/api/displays POST/GET DisplayNode の登録/一覧（座標・倍率・解像度）
/ws WS display.hello で参加（API Key 必須）

制限
• 最大画像 1024px, 1–3MB。サーバで webp 変換（透過保持時は png）

動作フロー 1. ユーザーが upload-app で作画 →/api/artworks へ送信 2. サーバが Asset 保存 →Artwork 登録 →QR トークン発行 → 返却 3. 運用 UI または自動ルールで Scene に scene_entities 追加 4. サーバが entity.add を Scene room へ broadcast 5. 各 DisplayNode が受信 → 初期状態確定 → ローカル tick 開始 6. 以降は WS 不安定でもローカル継続。再接続時に差分 sync

運用・ディスプレイ構成
• 単一大画面: DisplayNode=1、viewport=全域
• 壁面合成: 例 2×2 の 4 台
• display_nodes(x,y,width,height,scale) を設定
• 各 Node は同 Scene に参加。自分の viewport 内のみ描画
• ベイブレード対: spin-fight は近傍探索（grid hash）でペア選定。孤立時は待機

セキュリティと可用性
• API Key（api_keys）で ops と display を制限
• upload は origin 制限＋サイズ制限＋簡易レート
• ngrok 用に署名付き health を用意
• Redis ダウン時は新規追加不可だが既存は描画継続（クライアント自律）

MySQL DDL（完全版）

CREATE DATABASE IF NOT EXISTS exhibit
CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE exhibit;

CREATE TABLE users (
id BIGINT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE api_keys (
id BIGINT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
token CHAR(40) NOT NULL UNIQUE,
role ENUM('upload','display','ops') NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE assets (
id BIGINT AUTO_INCREMENT PRIMARY KEY,
path VARCHAR(255) NOT NULL, -- /data/assets/yyy/mm/dd/uuid.webp
mime VARCHAR(64) NOT NULL, -- image/webp, image/png, image/svg+xml など
width INT NOT NULL,
height INT NOT NULL,
bytes INT NOT NULL,
sha256 CHAR(64) NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
UNIQUE KEY ux_assets_sha256 (sha256)
) ENGINE=InnoDB;

CREATE TABLE artworks (
id BIGINT AUTO_INCREMENT PRIMARY KEY,
asset_id BIGINT NOT NULL,
user_id BIGINT NULL,
title VARCHAR(120) NULL,
tags JSON NULL,
qr_token CHAR(48) NOT NULL UNIQUE,
thumb_path VARCHAR(255) NOT NULL, -- 低解像度 or webp サムネ
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (asset_id) REFERENCES assets(id),
FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE scenes (
id BIGINT AUTO_INCREMENT PRIMARY KEY,
name VARCHAR(100) NOT NULL,
width INT NOT NULL, -- 仮想空間の幅（px）
height INT NOT NULL, -- 仮想空間の高さ（px）
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE scene_entities (
id BIGINT AUTO_INCREMENT PRIMARY KEY,
scene_id BIGINT NOT NULL,
artwork_id BIGINT NOT NULL,
-- 初期状態（揮発の seed となる）
init_x DOUBLE NOT NULL,
init_y DOUBLE NOT NULL,
init_vx DOUBLE NOT NULL,
init_vy DOUBLE NOT NULL,
init_angle DOUBLE NOT NULL DEFAULT 0,
init_scale DOUBLE NOT NULL DEFAULT 1,
animation_kind ENUM('pulsate','disperse','explode','spin_fight','stream_in') NOT NULL,
rng_seed BIGINT NOT NULL,
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (scene_id) REFERENCES scenes(id),
FOREIGN KEY (artwork_id) REFERENCES artworks(id),
INDEX idx_scene_entities_scene (scene_id)
) ENGINE=InnoDB;

CREATE TABLE display_nodes (
id BIGINT AUTO_INCREMENT PRIMARY KEY,
scene_id BIGINT NOT NULL,
name VARCHAR(100) NOT NULL,
-- 物理表示の論理ビューポート（仮想空間座標系）
viewport_x INT NOT NULL,
viewport_y INT NOT NULL,
viewport_w INT NOT NULL,
viewport_h INT NOT NULL,
scale DOUBLE NOT NULL DEFAULT 1,
-- 実ディスプレイ特性
pixel_width INT NOT NULL,
pixel_height INT NOT NULL,
device_key CHAR(40) NOT NULL UNIQUE, -- DisplayNode 用 API Key と対応
created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY (scene_id) REFERENCES scenes(id)
) ENGINE=InnoDB;

-- 補助インデックス
CREATE INDEX idx_artworks_asset ON artworks(asset_id);
CREATE INDEX idx_display_nodes_scene ON display_nodes(scene_id);

物理とアニメのロジック（クライアント）
• tick Δt 固定（例 16.7ms）
• 速度減衰少量、ノイズで揺らぎ
• 壁衝突: 軸ごとに反転、係数 0.9
• spin_fight: 空間をセル分割して近傍検索 → 最短距離のペアに角速度付与 → 反発
• disperse/explode: パーティクルは CPU ベース簡易粒子。上限 N=200 程度で負荷制御

運用手順（ローカル＋ ngrok 任意） 1. .env を複製して BACKEND_PORT=8080, MYSQL_DSN, REDIS_URL, ASSET_DIR=./data/assets を設定 2. docker-compose up -d（mysql, redis, backend, upload-app, display-app） 3. ops-app で Scene 作成（例 7680×2160） 4. 壁面枚数ぶん display-app を起動し、各ノードに device_key を設定 5. 必要なら ngrok http 8080。upload 側に外部 URL を配布 6. 当日: アップロード →scene_entities 自動追加（サーバのルールでアニメ種をラウンドロビン付与）→WS broadcast→ 表示

画像最適化
• 受信時に以下を適用
• 最大辺 1024px に縮小
• 透過あり: PNG、透過なし: WebP
• GIF は最初のフレームをサムネ。展示は video か canvas 再生にフォールバック
• サムネ生成は 512px 正方形クロップ or レターボックス

既存「花スロット」からの移行指針
• flower_slots → 廃止
• flowers → artworks に移行（slot_id 消滅、asset_id 参照に置換）
• 既存 QR トークンは artworks.qr_token に移設
• 表示グリッドは display_nodes の viewport で代替
