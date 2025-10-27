# システム要件定義／設計ドキュメント

## 1. 背景

展示会向けシステム。参加者が Web 上で絵を描きアップロードすると、共通画面上の「茎＋蕾」構造の中の空いている蕾にランダムでその絵が割り当てられ“花”として表示される。また描いたユーザーは QR コードを読み取って自分の絵を保存できる。

## 2. 機能要件

### 2.1 ユーザー側機能

- ユーザーが Web ブラウザ上で絵を描く（既実装）
- 描いた絵を「アップロード」ボタンでサーバに送信
- アップロード完了後、ユーザーに QR コードを提示
- 別の端末でその QR コードを読み取ることで、自分の描いた絵をダウンロード可能

### 2.2 共通画面側機能（展示用）

- 初期表示として、あらかじめ配置された茎＋蕾ユニット（例： grid 構造）を描画
- ユーザーが絵をアップロードすると、空いている蕾ユニットから **ランダムに** 1 つを選び、そこに「花（ユーザー絵）」を割り当てる
- 割り当てられた蕾ユニットは蕾表示から花表示に切り替わる（アニメーション可）
- 全蕾ユニットが花で埋まった場合、次の処理（例：新スロット追加／アーカイブ）に移行
- リアルタイムに新しい花の追加を反映（WebSocket 等）

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

## 5. システム設計

### 5.1 アーキテクチャ概要

- **フロントエンド**
  - 描画＋アップロードページ（既実装＋拡張）
  - 共通表示ページ（展示用）
- **バックエンド**
  - API サーバ（Go 言語）
  - WebSocket サービス
- **ストレージ**
  - リレーショナル DB（PostgreSQL）にメタデータ保存
  - ローカルファイルシステムに画像保存
- **配信／展示環境**
  - 会場 PC が展示用ブラウザを表示
  - 外部アクセスは ngrok 経由で可能

### 5.2 ディレクトリ構成（例）

/project-root
/backend
main.go
/api
/model
/storage
/ws
/frontend
/upload-app
/display-app
/common
/utils
docker-compose.yml
.env

### 5.3 データモデル（ER 概要）

- `flower_slots`（蕾ユニット）
  - slot_id, grid_x, grid_y, is_used, created_at, used_at
- `flowers`（実際の花／ユーザー絵）
  - id, slot_id (FK), user_id, image_path, upload_time, qr_token
- `users`（任意）
  - id, name, created_at

### 5.4 API 仕様

| エンドポイント      | メソッド  | 機能概要                                                                                                                 |
| ------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `/api/upload`       | POST      | ユーザー絵をアップロード。空き slot をランダムに選び割り当て。レスポンスに slot_id, grid_x, grid_y, qr_code_url を返す。 |
| `/download/{token}` | GET       | QR トークンに紐づく絵をダウンロード。                                                                                    |
| `/api/slots`        | GET       | 全 slot（蕾ユニット）の状態（grid_x, grid_y, is_used）を返す。初期表示用。                                               |
| `/ws`               | WebSocket | 新しい花追加イベントを全クライアントに送信。                                                                             |

### 5.5 共通画面 UI 設計

- グリッド（例：5 列 ×4 行＝ 20 ユニット）を画面中央に描画
- 各ユニットは茎＋蕾の表示（初期）
- 新花追加時、対象ユニットにて蕾 ➝ 花切り替えアニメーション（例フェードイン）
- 花にはユーザー絵の画像反映
- 枠が埋まったら「満席」表示または次ページ遷移

### 5.6 動作フロー（アップロードから表示まで）

1. ユーザーが描画完了 → アップロードボタン押下
2. フロントが `/api/upload` に画像＋ユーザー ID 等送信
3. サーバが `flower_slots` から `is_used=false` の行をランダム取得 → `is_used=true` に更新
4. `flowers` テーブルに新レコード挿入（slot_id 付き）
5. サーバが QR トークン生成 → `qr_code_url` をレスポンスで返却
6. フロント表示：QR コード提示
7. サーバが WebSocket 経由で全クライアントに `{type:"new_flower", slot_id, image_url, grid_x, grid_y}` イベント送信
8. 展示用クライアントがイベント受信 → UI 更新（蕾 ➝ 花）
9. 別端末でユーザーが QR コードを読み取る → `/download/{token}` へアクセス → 画像ダウンロード可能

### 5.7 技術的注意点・リスク対策

- 同時アップロード時の競合防止：DB トランザクション／ロックを活用
- 画像サイズ制限（例：5 MB／幅 1024px など）にて負荷軽減
- ネットワーク不安定対策：ローカルで動作可能な構成＋事前テスト
- QR コード読み取り障害対応：URL リンク併設
- 蕾枠が枯渇時の運用：あらかじめ十分枠準備／枠追加／古い花のアーカイブ化

## 6. 運用手順（展示会場準備）

- 会場 PC に環境（Go/React/postgresqlL）をセットアップ
- `.env` に必要変数（DB_URL, NGROK_TOKEN 等）を設定
- サーバ起動 → `ngrok http <backend_port>` で外部アクセス確保
- 描画用 URL（液タブ用） ／展示用 URL（プロジェクタ用）を準備
- 当日運用：ユーザー描画 → アップロード → QR 取得／読み取り → 展示画面反映
- 事前負荷テスト／画像読み込み速度確認

---

# DB スキーマ（完全版 DDL）

```sql
-- ======================================
-- データベース作成（未作成の場合）
-- ======================================
CREATE DATABASE IF NOT EXISTS flower_exhibit
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;
USE flower_exhibit;

-- ======================================
-- テーブル: users（任意：ユーザー管理用）
-- ======================================
CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;

-- ======================================
-- テーブル: flower_slots（蕾ユニット：茎＋蕾部分）
-- ======================================
CREATE TABLE flower_slots (
  slot_id INT AUTO_INCREMENT PRIMARY KEY,
  grid_x INT NOT NULL,
  grid_y INT NOT NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at DATETIME NULL,
  UNIQUE KEY ux_flower_slots_grid (grid_x, grid_y)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;

-- ======================================
-- テーブル: flowers（ユーザーからアップロードされた「花」）
-- ======================================
CREATE TABLE flowers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slot_id INT NOT NULL,
  user_id BIGINT NULL,
  image_path VARCHAR(256) NOT NULL,
  upload_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  qr_token VARCHAR(64) NOT NULL UNIQUE,
  FOREIGN KEY (slot_id) REFERENCES flower_slots(slot_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_general_ci;

-- ======================================
-- インデックス追加（パフォーマンス配慮）
-- ======================================
-- slot_id による検索が多くなる想定のため
CREATE INDEX idx_flowers_slot_id ON flowers(slot_id);

-- ======================================
-- 初期データ投入：flower_slots にあらかじめ配置する蕾ユニット
-- 例：5列 × 4行（計20スロット）
-- ======================================
INSERT INTO flower_slots (grid_x, grid_y)
VALUES
  (1,1),(2,1),(3,1),(4,1),(5,1),
  (1,2),(2,2),(3,2),(4,2),(5,2),
  (1,3),(2,3),(3,3),(4,3),(5,3),
  (1,4),(2,4),(3,4),(4,4),(5,4);

-- ======================================
-- （必要に応じて）アクセス制御用ユーザ・権限設定など
-- ======================================
-- GRANT ALL ON flower_exhibit.* TO 'exhibit_user'@'%' IDENTIFIED BY 'secure_password';
-- FLUSH PRIVILEGES;
```
