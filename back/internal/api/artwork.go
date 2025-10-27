package api

import (
	"culture-festival-backend/internal/domain"
	"culture-festival-backend/internal/repo"
	"culture-festival-backend/internal/storage"
	"culture-festival-backend/internal/ws"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ArtworkHandler struct {
	artworkRepo *repo.ArtworkRepository
	assetRepo   *repo.AssetRepository
	sceneRepo   *repo.SceneRepository
	entityRepo  *repo.SceneEntityRepository
	imageProc   *storage.ImageProcessor
	hub         *ws.Hub
}

func NewArtworkHandler(
	artworkRepo *repo.ArtworkRepository,
	assetRepo *repo.AssetRepository,
	sceneRepo *repo.SceneRepository,
	entityRepo *repo.SceneEntityRepository,
	imageProc *storage.ImageProcessor,
	hub *ws.Hub,
) *ArtworkHandler {
	return &ArtworkHandler{
		artworkRepo: artworkRepo,
		assetRepo:   assetRepo,
		sceneRepo:   sceneRepo,
		entityRepo:  entityRepo,
		imageProc:   imageProc,
		hub:         hub,
	}
}

type UploadRequest struct {
	Title string `json:"title"`
	Tags  string `json:"tags"`
}

type UploadResponse struct {
	ArtworkID uint   `json:"artwork_id"`
	AssetURL  string `json:"asset_url"`
	ThumbURL  string `json:"thumb_url"`
	QRToken   string `json:"qr_token"`
}

func (h *ArtworkHandler) Upload(c *gin.Context) {
	// ファイルを取得
	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No image file provided"})
		return
	}
	defer file.Close()

	// リクエストデータを取得
	title := c.PostForm("title")
	tags := c.PostForm("tags")

	// 画像を処理
	processedImg, err := h.imageProc.ProcessUpload(file, header)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to process image: %v", err)})
		return
	}

	// 既存のアセットをチェック
	asset, err := h.assetRepo.GetBySHA256(processedImg.SHA256)
	if err != nil {
		// 既存のアセットがない場合は新規作成
		asset = &domain.Asset{
			Path:  processedImg.Path,
			Mime:  processedImg.Mime,
			Width: processedImg.Width,
			Height: processedImg.Height,
			Bytes: processedImg.Bytes,
			SHA256: processedImg.SHA256,
		}

		if err := h.assetRepo.Create(asset); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save asset"})
			return
		}
	}

	// QRトークンを生成
	qrToken := uuid.New().String()

	// タグをJSON配列に変換
	var tagsJSON json.RawMessage
	if tags != "" {
		// カンマ区切りのタグを配列に変換
		tagList := strings.Split(tags, ",")
		for i, tag := range tagList {
			tagList[i] = strings.TrimSpace(tag)
		}
		tagsBytes, _ := json.Marshal(tagList)
		tagsJSON = json.RawMessage(tagsBytes)
	} else {
		tagsJSON = json.RawMessage("[]")
	}

	// アートワークを保存
	artwork := &domain.Artwork{
		AssetID:   asset.ID,
		Title:     &title,
		Tags:      &tagsJSON,
		QRToken:   qrToken,
		ThumbPath: processedImg.ThumbPath,
	}

	if err := h.artworkRepo.Create(artwork); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save artwork"})
		return
	}

	// デフォルトシーン（ID=1）にエンティティを追加
	sceneID := uint(1)
	x, y, vx, vy := repo.GenerateRandomPositionAndVelocity(1920, 1080) // デフォルトサイズ
	
	entity := &domain.SceneEntity{
		SceneID:       sceneID,
		ArtworkID:     artwork.ID,
		InitX:         x,
		InitY:         y,
		InitVX:        vx,
		InitVY:        vy,
		InitAngle:     0,
		InitScale:     1,
		AnimationKind: repo.GetNextAnimationKind(),
		RNGSeed:       repo.GetRandomRNGSeed(),
	}

	if err := h.entityRepo.Create(entity); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add entity to scene"})
		return
	}

	// WebSocketでブロードキャスト
	fmt.Printf("Broadcasting entity add: entity_id=%d, scene_id=%d\n", entity.ID, entity.SceneID)
	h.broadcastEntityAdd(entity, artwork, asset)

	// レスポンスを返す
	response := UploadResponse{
		ArtworkID: artwork.ID,
		AssetURL:  fmt.Sprintf("/download/%s", qrToken),
		ThumbURL:  fmt.Sprintf("/download/%s?thumb=true", qrToken),
		QRToken:   qrToken,
	}

	c.JSON(http.StatusOK, response)
}

func (h *ArtworkHandler) GetByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid artwork ID"})
		return
	}

	artwork, err := h.artworkRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Artwork not found"})
		return
	}

	c.JSON(http.StatusOK, artwork)
}

func (h *ArtworkHandler) GetAll(c *gin.Context) {
	artworks, err := h.artworkRepo.GetAll()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get artworks"})
		return
	}

	c.JSON(http.StatusOK, artworks)
}

func (h *ArtworkHandler) Delete(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid artwork ID"})
		return
	}

	if err := h.artworkRepo.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete artwork"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Artwork deleted successfully"})
}

func (h *ArtworkHandler) Download(c *gin.Context) {
	token := c.Param("token")
	thumb := c.Query("thumb") == "true"

	fmt.Printf("Download request: token=%s, thumb=%v\n", token, thumb)
	
	artwork, err := h.artworkRepo.GetByQRToken(token)
	if err != nil {
		fmt.Printf("Artwork not found: token=%s, error=%v\n", token, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Artwork not found"})
		return
	}
	
	fmt.Printf("Artwork found: id=%d, thumb_path=%s\n", artwork.ID, artwork.ThumbPath)

	var filePath string
	if thumb {
		filePath = artwork.ThumbPath
	} else {
		filePath = artwork.Asset.Path
	}

	// ファイルが存在するかチェック
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// ファイルを配信
	c.File(filePath)
}

func (h *ArtworkHandler) broadcastEntityAdd(entity *domain.SceneEntity, artwork *domain.Artwork, asset *domain.Asset) {
	room := fmt.Sprintf("scene:%d", entity.SceneID)
	
	message := ws.Message{
		Type: "entity.add",
		Data: map[string]interface{}{
			"entity_id": entity.ID,
			"artwork_url": fmt.Sprintf("/download/%s", artwork.QRToken),
			"init": map[string]interface{}{
				"x": entity.InitX,
				"y": entity.InitY,
				"vx": entity.InitVX,
				"vy": entity.InitVY,
				"angle": entity.InitAngle,
				"scale": entity.InitScale,
			},
			"animation_kind": entity.AnimationKind,
			"seed": entity.RNGSeed,
		},
	}

	fmt.Printf("Broadcasting to room: %s\n", room)
	h.hub.BroadcastToRoom(room, message)
}
