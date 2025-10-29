# 🎨 展示会向け浮遊アートシステム

参加者が描いた絵が共通画面上で美しく浮遊・アニメーションする展示会向けシステムです。

## ✨ 特徴

- **美しい浮遊アニメーション**: 5 種類のアニメーション（pulsate, disperse, explode, spin_fight, stream_in）
- **リアルタイム表示**: WebSocket による即座の反映
- **マルチディスプレイ対応**: 複数画面での壁面合成
- **直感的な操作**: 簡単な Web インターフェース
- **Docker 対応**: 簡単なセットアップとデプロイ

## 🏗️ システム構成

### フロントエンド

- **upload-app** (ポート 3000): お絵かき・アップロード機能
- **display-app** (ポート 3001): 浮遊表示システム
- **ops-app** (ポート 3002): 運用管理 UI

### バックエンド

- **Go + Gin**: REST API + WebSocket（ポート 8080）
- **PostgreSQL**: データ永続化
- **Redis**: リアルタイム通信・揮発状態管理

## 🚀 クイックスタート

### 1. 環境準備

```bash
# リポジトリをクローン
git clone <repository-url>
cd CultureFestival

# 必要に応じて環境変数を調整
# docker-compose.ymlで設定されています
```

### 2. Docker で起動

```bash
# 全サービスを起動
docker-compose up -d

# ログを確認
docker-compose logs -f

# 特定のサービスのログを確認
docker-compose logs -f backend
```

### 3. アクセス

- **お絵かきアプリ**: http://localhost:3000
- **浮遊表示**: http://localhost:3001
- **運用管理**: http://localhost:3002
- **API**: http://localhost:8080
- **WebSocket**: ws://localhost:8080/ws

## 📱 使用方法

### 1. 作品を描いてアップロード

1. http://localhost:3000 にアクセス
2. マンダラ風の対称描画で作品を作成
3. 「アップロード」ボタンでサーバに送信
4. 自動的にデフォルトシーン（ID=1）に追加されます

### 2. 浮遊表示を確認

1. http://localhost:3001 にアクセス
2. アップロードした作品が美しく浮遊する様子を確認
3. デバッグ表示でエンティティの状態を監視可能

### 3. 運用管理

1. http://localhost:3002 にアクセス
2. シーンの作成・管理
3. アートワークをシーンに手動で追加
4. シーンのリセット・エンティティの削除

## 🎮 アニメーション種類

すべての絵は基本的にふわふわと移動しつつ、画面端を壁として跳ね返ります。それに加えて以下のアニメーションのいずれかを持ちます：

1. **pulsate**: 拡大縮小を繰り返す脈動アニメーション
2. **disperse**: パーティクルに分解して再結合
3. **explode**: 爆散して消滅または再生
4. **spin_fight**: 近傍のペアと高速回転して衝突（ベイブレード風）
5. **stream_in**: 画面端から流れてくる流入アニメーション

※ アニメーションは各エンティティ作成時にランダムまたは指定で割り当てられます

## 🔧 開発・カスタマイズ

### バックエンド開発

```bash
cd back

# 依存関係のインストール
go mod tidy

# ローカルで実行（PostgreSQLとRedisが必要）
# 環境変数を設定してから実行
export POSTGRES_DSN="postgres://exhibit_user:exhibit_password@localhost:5432/exhibit?sslmode=disable"
export REDIS_URL="localhost:6379"
export ASSET_DIR="./data/assets"
export BACKEND_PORT="8080"

go run cmd/server/main.go
```

### フロントエンド開発

各アプリのディレクトリ（`front/`）で HTML/JS/CSS ファイルを編集します。
静的ファイルなので変更は即座に反映されます。

### データベース管理

```bash
# PostgreSQLに接続
docker exec -it culture_festival_postgres psql -U exhibit_user -d exhibit

# テーブル一覧確認
\dt

# マイグレーションは起動時に自動実行されます
```

## 📊 API 仕様

### アートワーク

- `POST /api/artworks` - 画像アップロード（multipart/form-data）
  - フィールド: `image` (file), `title` (string), `tags` (string)
  - レスポンス: アートワークID、アセットURL、サムネイルURL
- `GET /api/artworks` - アートワーク一覧取得
- `GET /api/artworks/{id}` - 特定のアートワーク取得
- `DELETE /api/artworks/{id}` - アートワーク削除
- `GET /download/{token}` - 画像ダウンロード（QRコード用）

### シーン

- `POST /api/scenes` - シーン作成
  - ボディ: `{"name": "シーン名", "width": 1920, "height": 1080}`
- `GET /api/scenes` - シーン一覧取得
- `GET /api/scenes/{id}` - シーン詳細取得
- `POST /api/scenes/{id}/entities` - エンティティ追加
  - ボディ: `{"artwork_id": 1, "init_x": 100, "init_y": 100, "animation_kind": "pulsate", ...}`
- `PUT /api/scenes/{id}/entities/{entity_id}` - エンティティ更新
- `DELETE /api/scenes/{id}/entities/{entity_id}` - エンティティ削除
- `POST /api/scenes/{id}/reset` - シーンリセット（全エンティティ削除）

### WebSocket

- `ws://localhost:8080/ws` - リアルタイム通信
  - クライアント→サーバ: `display.hello`, `state.report`
  - サーバ→クライアント: `entity.add`, `entity.remove`, `scene.reset`, `clock.sync`

### 静的ファイル

- `/assets/*` - アップロードされた画像ファイル

## 🎯 展示会での運用

### 事前準備

1. 会場のネットワーク環境を確認
2. ディスプレイの配置と解像度を設定
3. デフォルトシーン（ID=1）を作成・設定
4. Docker環境のテスト起動

### 当日の運用

1. システムを起動（`docker-compose up -d`）
2. 浮遊表示（display-app）を会場に投影
3. 参加者にお絵かきアプリ（upload-app）のURLを案内
4. 必要に応じて運用管理UI（ops-app）で調整
   - エンティティの削除
   - シーンのリセット
   - 新しいシーンへの切り替え

### マルチディスプレイ構成

複数のディスプレイで壁面を合成する場合：
1. 各ディスプレイで display-app を開く
2. viewport設定で座標と範囲を指定
3. 同一シーンに接続することで全体を分割表示

### トラブルシューティング

- **接続が不安定**: ブラウザをリフレッシュ、WebSocket再接続
- **表示が止まった**: 運用管理UIでシーンをリセット
- **パフォーマンス問題**: エンティティ数を制限（目安: 200個以下）
- **画像が表示されない**: `/data/assets`ディレクトリの権限確認
- **データベースエラー**: `docker-compose logs postgres`でログ確認

## � システム仕様・制約

### データモデル

- **Artwork**: 絵のメタデータ（タイトル、タグ、作者情報）
- **Asset**: 画像バイナリ（PNG/JPG/WebP/GIF/SVG対応）
- **Scene**: 論理的な展示空間（幅・高さ設定）
- **SceneEntity**: Sceneに配置されたArtworkのインスタンス（位置・速度・アニメーション種）
- **揮発状態**: 実行時の位置・速度・回転などはクライアント側で管理

### 制限事項

- **画像サイズ**: 最大1024px、1-3MB
- **同時接続数**: 100人程度を想定
- **エンティティ数**: 200個程度まで安定動作
- **画像最適化**: サーバ側でWebP変換、サムネイル自動生成

### 物理演算

- クライアント側（各DisplayNode）でtick実行
- サーバは初期値と乱数シードのみ配布
- 壁反射、速度減衰、パーティクル分解など
- WebSocketダウン時もローカルで継続動作

## 🔒 技術スタック

### バックエンド
- **Go 1.20+**: サーバサイド実装
- **Gin**: Webフレームワーク
- **PostgreSQL 15**: リレーショナルデータベース
- **Redis 6**: キャッシュ・Pub/Sub

### フロントエンド
- **HTML5 Canvas**: 描画・表示
- **Vanilla JavaScript**: フレームワークなし
- **WebSocket**: リアルタイム通信

### インフラ
- **Docker & Docker Compose**: コンテナ化
- **Nginx**: 静的ファイル配信（フロントエンド）

## 📁 ディレクトリ構成

```
/CultureFestival
├── back/                      # バックエンド（Go）
│   ├── cmd/server/           # エントリーポイント
│   ├── config/               # 設定管理
│   ├── internal/
│   │   ├── api/             # HTTPハンドラー
│   │   ├── domain/          # ドメインモデル
│   │   ├── repo/            # データアクセス層
│   │   ├── storage/         # ファイルストレージ
│   │   └── ws/              # WebSocket管理
│   └── migrations/          # DBマイグレーション
├── front/                     # フロントエンド
│   ├── index.html           # upload-app
│   ├── display.html         # display-app
│   ├── ops.html             # ops-app
│   └── Dockerfile.*         # 各アプリのDocker設定
├── data/                      # 永続化データ
│   └── assets/              # アップロード画像
├── docker-compose.yml        # Docker構成
├── Design.md                 # 詳細設計書
└── README.md                 # このファイル
```

## 🤝 貢献・開発

### ブランチ戦略

```bash
# 新機能開発
git checkout -b feature/new-feature

# バグ修正
git checkout -b fix/bug-description

# プルリクエストを作成
```

### コーディング規約

- **Go**: `go fmt`でフォーマット、`golint`でリント
- **JavaScript**: ES6+構文、セミコロンあり
- コミットメッセージ: 日本語または英語で明確に

## 📚 参考資料

- [Design.md](./Design.md) - 詳細な設計ドキュメント
- [Docker Compose ドキュメント](https://docs.docker.com/compose/)
- [Gin フレームワーク](https://gin-gonic.com/)
- [PostgreSQL ドキュメント](https://www.postgresql.org/docs/)

## 🆘 サポート・トラブルシューティング

問題が発生した場合：

1. **ログを確認**: `docker-compose logs -f [service-name]`
2. **コンテナ状態確認**: `docker-compose ps`
3. **再起動**: `docker-compose restart [service-name]`
4. **完全リセット**: 
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```

GitHubのIssuesで報告または開発チームに連絡してください。

## 📄 ライセンス

MIT License

---

**チームラボ風の美しい展示会システムをお楽しみください！** ✨🎨
