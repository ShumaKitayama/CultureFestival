package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
)

// データベース接続
var db *sql.DB

// WebSocket接続管理
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // 開発環境用
	},
}

var clients = make(map[*websocket.Conn]bool)

// データモデル
type FlowerSlot struct {
	SlotID   int    `json:"slot_id"`
	GridX    int    `json:"grid_x"`
	GridY    int    `json:"grid_y"`
	IsUsed   bool   `json:"is_used"`
	UsedAt   *time.Time `json:"used_at,omitempty"`
}

type Flower struct {
	ID         int64     `json:"id"`
	SlotID     int       `json:"slot_id"`
	UserID     *int64    `json:"user_id,omitempty"`
	ImagePath  string    `json:"image_path"`
	UploadTime time.Time `json:"upload_time"`
	QRToken    string    `json:"qr_token"`
}

type UploadResponse struct {
	SlotID     int    `json:"slot_id"`
	GridX      int    `json:"grid_x"`
	GridY      int    `json:"grid_y"`
	QRCodeURL  string `json:"qr_code_url"`
	ImageURL   string `json:"image_url"`
}

type WebSocketMessage struct {
	Type     string `json:"type"`
	SlotID   int    `json:"slot_id"`
	GridX    int    `json:"grid_x"`
	GridY    int    `json:"grid_y"`
	ImageURL string `json:"image_url"`
}

func main() {
	// 環境変数から設定を取得
	dbHost := getEnv("DB_HOST", "localhost")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPassword := getEnv("DB_PASSWORD", "password")
	dbName := getEnv("DB_NAME", "flower_exhibit")
	port := getEnv("PORT", "8080")

	// データベース接続
	var err error
	dbInfo := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPassword, dbName)
	
	db, err = sql.Open("postgres", dbInfo)
	if err != nil {
		log.Fatal("データベース接続エラー:", err)
	}
	defer db.Close()

	// 接続テスト
	if err = db.Ping(); err != nil {
		log.Fatal("データベース接続テスト失敗:", err)
	}

	// uploadsディレクトリ作成
	os.MkdirAll("uploads", 0755)

	// ルーター設定
	r := mux.NewRouter()

	// CORS設定
	r.Use(corsMiddleware)

	// API エンドポイント
	r.HandleFunc("/api/upload", uploadHandler).Methods("POST")
	r.HandleFunc("/api/slots", getSlotsHandler).Methods("GET")
	r.HandleFunc("/api/reset", resetHandler).Methods("POST")
	r.HandleFunc("/download/{token}", downloadHandler).Methods("GET")
	r.HandleFunc("/ws", websocketHandler)

	// 静的ファイル配信
	r.PathPrefix("/uploads/").Handler(http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads/"))))
	
	// フロントエンドファイル配信
	r.PathPrefix("/front/").Handler(http.StripPrefix("/front/", http.FileServer(http.Dir("./front/"))))
	r.PathPrefix("/display/").Handler(http.StripPrefix("/display/", http.FileServer(http.Dir("./display/"))))
	
	// ルートアクセス時のリダイレクト
	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/display/", http.StatusFound)
	})

	// サーバー起動
	log.Printf("サーバー起動中... ポート: %s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// アップロードハンドラー
func uploadHandler(w http.ResponseWriter, r *http.Request) {
	// ファイルサイズ制限（5MB）
	r.ParseMultipartForm(5 << 20)

	file, handler, err := r.FormFile("image")
	if err != nil {
		http.Error(w, "ファイルの取得に失敗しました", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 画像形式チェック
	if !isValidImageType(handler.Header.Get("Content-Type")) {
		http.Error(w, "サポートされていない画像形式です", http.StatusBadRequest)
		return
	}

	// 空きスロットをランダムに取得
	var slotID, gridX, gridY int
	err = db.QueryRow(`
		SELECT slot_id, grid_x, grid_y 
		FROM flower_slots 
		WHERE is_used = false 
		ORDER BY RANDOM() 
		LIMIT 1
	`).Scan(&slotID, &gridX, &gridY)
	
	if err != nil {
		http.Error(w, "空きスロットが見つかりません", http.StatusServiceUnavailable)
		return
	}

	// トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "データベースエラー", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// スロットを使用中にマーク
	_, err = tx.Exec("UPDATE flower_slots SET is_used = true, used_at = NOW() WHERE slot_id = $1", slotID)
	if err != nil {
		http.Error(w, "スロット更新エラー", http.StatusInternalServerError)
		return
	}

	// ファイル保存
	qrToken := uuid.New().String()
	fileName := fmt.Sprintf("%s_%d.png", qrToken, time.Now().Unix())
	filePath := filepath.Join("uploads", fileName)
	
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "ファイル保存エラー", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	_, err = io.Copy(dst, file)
	if err != nil {
		http.Error(w, "ファイル保存エラー", http.StatusInternalServerError)
		return
	}

	// flowersテーブルに挿入
	var flowerID int64
	err = tx.QueryRow(`
		INSERT INTO flowers (slot_id, image_path, qr_token) 
		VALUES ($1, $2, $3) 
		RETURNING id
	`, slotID, filePath, qrToken).Scan(&flowerID)
	
	if err != nil {
		http.Error(w, "データベース挿入エラー", http.StatusInternalServerError)
		return
	}

	// トランザクションコミット
	if err = tx.Commit(); err != nil {
		http.Error(w, "データベースコミットエラー", http.StatusInternalServerError)
		return
	}

	// WebSocketで全クライアントに通知
	message := WebSocketMessage{
		Type:     "new_flower",
		SlotID:   slotID,
		GridX:    gridX,
		GridY:    gridY,
		ImageURL: fmt.Sprintf("/uploads/%s", fileName),
	}
	
	broadcastMessage(message)

	// レスポンス
	response := UploadResponse{
		SlotID:    slotID,
		GridX:     gridX,
		GridY:     gridY,
		QRCodeURL: fmt.Sprintf("/download/%s", qrToken),
		ImageURL:  fmt.Sprintf("/uploads/%s", fileName),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// スロット一覧取得ハンドラー
func getSlotsHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query(`
		SELECT fs.slot_id, fs.grid_x, fs.grid_y, fs.is_used, fs.used_at,
		       f.image_path
		FROM flower_slots fs
		LEFT JOIN flowers f ON fs.slot_id = f.slot_id
		ORDER BY fs.grid_x, fs.grid_y
	`)
	if err != nil {
		http.Error(w, "データベースエラー", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var slots []map[string]interface{}
	for rows.Next() {
		var slotID, gridX, gridY int
		var isUsed bool
		var usedAt *time.Time
		var imagePath *string

		err := rows.Scan(&slotID, &gridX, &gridY, &isUsed, &usedAt, &imagePath)
		if err != nil {
			continue
		}

		slot := map[string]interface{}{
			"slot_id":  slotID,
			"grid_x":   gridX,
			"grid_y":   gridY,
			"is_used":  isUsed,
			"used_at":  usedAt,
		}

		if imagePath != nil {
			slot["image_url"] = "/uploads/" + filepath.Base(*imagePath)
		}

		slots = append(slots, slot)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(slots)
}

// ダウンロードハンドラー
func downloadHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	token := vars["token"]

	var imagePath string
	err := db.QueryRow("SELECT image_path FROM flowers WHERE qr_token = $1", token).Scan(&imagePath)
	if err != nil {
		http.Error(w, "画像が見つかりません", http.StatusNotFound)
		return
	}

	// ファイル存在チェック
	if _, err := os.Stat(imagePath); os.IsNotExist(err) {
		http.Error(w, "ファイルが見つかりません", http.StatusNotFound)
		return
	}

	// ファイル配信
	w.Header().Set("Content-Disposition", "attachment; filename=flower.png")
	http.ServeFile(w, r, imagePath)
}

// WebSocketハンドラー
func websocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket接続エラー:", err)
		return
	}
	defer conn.Close()

	clients[conn] = true
	log.Println("WebSocketクライアント接続")

	// 接続維持
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket接続終了:", err)
			delete(clients, conn)
			break
		}
	}
}

// WebSocketメッセージブロードキャスト
func broadcastMessage(message WebSocketMessage) {
	for client := range clients {
		err := client.WriteJSON(message)
		if err != nil {
			log.Println("WebSocket送信エラー:", err)
			client.Close()
			delete(clients, client)
		}
	}
}

// リセットハンドラー
func resetHandler(w http.ResponseWriter, r *http.Request) {
	// トランザクション開始
	tx, err := db.Begin()
	if err != nil {
		http.Error(w, "データベースエラー", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback()

	// flowersテーブルの全データを削除
	_, err = tx.Exec("DELETE FROM flowers")
	if err != nil {
		http.Error(w, "flowersテーブル削除エラー", http.StatusInternalServerError)
		return
	}

	// flower_slotsテーブルを初期状態にリセット
	_, err = tx.Exec("UPDATE flower_slots SET is_used = false, used_at = NULL")
	if err != nil {
		http.Error(w, "flower_slotsテーブルリセットエラー", http.StatusInternalServerError)
		return
	}

	// uploadsディレクトリの画像ファイルを削除
	files, err := filepath.Glob("uploads/*")
	if err == nil {
		for _, file := range files {
			os.Remove(file)
		}
	}

	// トランザクションコミット
	if err = tx.Commit(); err != nil {
		http.Error(w, "データベースコミットエラー", http.StatusInternalServerError)
		return
	}

	// WebSocketで全クライアントにリセット通知
	resetMessage := WebSocketMessage{
		Type: "reset",
	}
	broadcastMessage(resetMessage)

	// 成功レスポンス
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "reset_complete"})
}

// 画像形式チェック
func isValidImageType(contentType string) bool {
	validTypes := []string{
		"image/jpeg",
		"image/jpg", 
		"image/png",
		"image/gif",
		"image/webp",
	}
	
	for _, validType := range validTypes {
		if contentType == validType {
			return true
		}
	}
	return false
}
