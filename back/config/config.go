package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	PostgresDSN  string
	RedisURL     string
	AssetDir     string
	BackendPort  string
	UploadAPIKey string
	DisplayAPIKey string
	OpsAPIKey    string
}

func Load() *Config {
	// .envファイルを読み込み（存在する場合）
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	return &Config{
		PostgresDSN:  getEnv("POSTGRES_DSN", "postgres://exhibit_user:exhibit_password@localhost:5432/exhibit?sslmode=disable"),
		RedisURL:     getEnv("REDIS_URL", "localhost:6379"),
		AssetDir:     getEnv("ASSET_DIR", "./data/assets"),
		BackendPort:  getEnv("BACKEND_PORT", "8080"),
		UploadAPIKey: getEnv("UPLOAD_API_KEY", "upload_dev_key_12345"),
		DisplayAPIKey: getEnv("DISPLAY_API_KEY", "display_dev_key_12345"),
		OpsAPIKey:    getEnv("OPS_API_KEY", "ops_dev_key_12345"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
