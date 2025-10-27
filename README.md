# 🌸 文化祭展示システム

参加者が描いた絵を花として展示するインタラクティブなシステムです。

## 🚀 クイックスタート

### 1. システム起動

```bash
./start.sh
```

### 2. アクセス

- **描画用**: http://localhost:8080/../front/index.html
- **展示用**: http://localhost:8080/../display/index.html

### 3. 外部アクセス（ngrok 使用）

```bash
ngrok http 8080
```

## 🎯 機能

### ユーザー側

- Web ブラウザ上で絵を描く
- 描いた絵をアップロード
- QR コードで画像をダウンロード

### 展示側

- 7 列 ×4 行のグリッド表示
- リアルタイムで花が咲くアニメーション
- WebSocket による即座の反映

## 🛠 技術スタック

- **バックエンド**: Go + Gorilla Mux
- **データベース**: PostgreSQL
- **フロントエンド**: HTML/CSS/JavaScript
- **リアルタイム通信**: WebSocket
- **コンテナ**: Docker

## 📁 ディレクトリ構成

```
CultureFestival/
├── back/                 # バックエンド（Go）
├── front/               # 描画用フロントエンド
├── display/             # 展示用フロントエンド
├── uploads/            # 画像保存
├── docker-compose.yml   # Docker設定
└── start.sh            # 起動スクリプト
```

## 🔧 設定

### 環境変数（.env）

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=flower_exhibit
PORT=8080
```

## 🎨 使用方法

1. **描画**: 描画用ページで絵を描く
2. **アップロード**: 「アップロード」ボタンをクリック
3. **QR コード**: 表示された QR コードを別端末で読み取り
4. **展示**: 展示用ページでリアルタイムに花が咲く

## 🛑 停止

```bash
docker-compose down
```

## 📝 注意事項

- 画像サイズ制限: 5MB
- 最大画像サイズ: 1024px
- 同時接続数: 100 人程度想定
- ローカル環境での動作を前提

## 🎉 展示会場での運用

1. 会場 PC でシステム起動
2. 描画用 URL をタブレット等に設定
3. 展示用 URL をプロジェクター等に設定
4. 参加者が絵を描いてアップロード
5. リアルタイムで展示画面に花が咲く
