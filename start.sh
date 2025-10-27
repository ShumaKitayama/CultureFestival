#!/bin/bash

echo "🌸 文化祭システム起動中... 🌸"

# 現在のディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 必要なディレクトリを作成
mkdir -p uploads
mkdir -p logs

echo "📦 Docker Composeでサービスを起動中..."

# Docker Composeでサービスを起動
docker-compose up -d --build

echo "⏳ サービス起動を待機中..."
sleep 10

# サービス状態確認
echo "🔍 サービス状態確認:"
docker-compose ps

echo ""
echo "✅ システム起動完了！"
echo ""
echo "🌐 アクセスURL:"
echo "  描画用: http://localhost:8080/../front/index.html"
echo "  展示用: http://localhost:8080/../display/index.html"
echo ""
echo "📱 外部アクセス（ngrok使用時）:"
echo "  ngrok http 8080"
echo ""
echo "🛑 停止するには: docker-compose down"
echo ""
