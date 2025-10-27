package main

import (
	"culture-festival-backend/config"
	"culture-festival-backend/internal/api"
	"culture-festival-backend/internal/repo"
	"culture-festival-backend/internal/storage"
	"culture-festival-backend/internal/ws"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	// 設定を読み込み
	cfg := config.Load()

	// データベース接続
	db, err := repo.NewDatabase(cfg.PostgresDSN)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Redis接続
	_, err = repo.NewRedisClient(cfg.RedisURL)
	if err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}

	// 画像プロセッサー
	imageProc := storage.NewImageProcessor(cfg.AssetDir)

	// WebSocketハブ
	hub := ws.NewHub()
	go hub.Run()

	// リポジトリを作成
	artworkRepo := repo.NewArtworkRepository(db.DB)
	assetRepo := repo.NewAssetRepository(db.DB)
	sceneRepo := repo.NewSceneRepository(db.DB)
	entityRepo := repo.NewSceneEntityRepository(db.DB)

	// ハンドラーを作成
	artworkHandler := api.NewArtworkHandler(artworkRepo, assetRepo, sceneRepo, entityRepo, imageProc, hub)
	sceneHandler := api.NewSceneHandler(sceneRepo, entityRepo, hub)

	// Ginルーターを設定
	r := gin.Default()

	// CORS設定
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	})

	// 静的ファイル配信
	r.Static("/assets", cfg.AssetDir)

	// APIルート
	apiGroup := r.Group("/api")
	{
		// アートワーク関連
		artworks := apiGroup.Group("/artworks")
		{
			artworks.POST("", artworkHandler.Upload)
			artworks.GET("", artworkHandler.GetAll)
			artworks.GET("/:id", artworkHandler.GetByID)
			artworks.DELETE("/:id", artworkHandler.Delete)
		}

		// シーン関連
		scenes := apiGroup.Group("/scenes")
		{
			scenes.POST("", sceneHandler.CreateScene)
			scenes.GET("", sceneHandler.GetScenes)
			scenes.GET("/:id", sceneHandler.GetSceneByID)
			scenes.POST("/:id/entities", sceneHandler.AddEntity)
			scenes.PUT("/:id/entities/:entity_id", sceneHandler.UpdateEntity)
			scenes.DELETE("/:id/entities/:entity_id", sceneHandler.DeleteEntity)
			scenes.POST("/:id/reset", sceneHandler.ResetScene)
		}
	}

	// ダウンロードエンドポイント
	r.GET("/download/:token", artworkHandler.Download)

	// WebSocketエンドポイント
	r.GET("/ws", func(c *gin.Context) {
		ws.ServeWS(hub, c.Writer, c.Request)
	})

	// ヘルスチェック
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Printf("Server starting on port %s", cfg.BackendPort)
	log.Fatal(r.Run(":" + cfg.BackendPort))
}
