package api

import (
	"culture-festival-backend/internal/domain"
	"culture-festival-backend/internal/repo"
	"culture-festival-backend/internal/ws"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type SceneHandler struct {
	sceneRepo  *repo.SceneRepository
	entityRepo *repo.SceneEntityRepository
	hub        *ws.Hub
}

func NewSceneHandler(
	sceneRepo *repo.SceneRepository,
	entityRepo *repo.SceneEntityRepository,
	hub *ws.Hub,
) *SceneHandler {
	return &SceneHandler{
		sceneRepo:  sceneRepo,
		entityRepo: entityRepo,
		hub:        hub,
	}
}

type CreateSceneRequest struct {
	Name   string `json:"name" binding:"required"`
	Width  int    `json:"width" binding:"required"`
	Height int    `json:"height" binding:"required"`
}

type AddEntityRequest struct {
	ArtworkID     uint    `json:"artwork_id" binding:"required"`
	InitX         float64 `json:"init_x"`
	InitY         float64 `json:"init_y"`
	InitVX        float64 `json:"init_vx"`
	InitVY        float64 `json:"init_vy"`
	InitAngle     float64 `json:"init_angle"`
	InitScale     float64 `json:"init_scale"`
	AnimationKind string  `json:"animation_kind"`
}

func (h *SceneHandler) CreateScene(c *gin.Context) {
	var req CreateSceneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	scene := &domain.Scene{
		Name:   req.Name,
		Width:  req.Width,
		Height: req.Height,
	}

	if err := h.sceneRepo.Create(scene); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create scene"})
		return
	}

	c.JSON(http.StatusOK, scene)
}

func (h *SceneHandler) GetScenes(c *gin.Context) {
	scenes, err := h.sceneRepo.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get scenes"})
		return
	}

	c.JSON(http.StatusOK, scenes)
}

func (h *SceneHandler) GetSceneByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scene ID"})
		return
	}

	scene, err := h.sceneRepo.GetByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Scene not found"})
		return
	}

	c.JSON(http.StatusOK, scene)
}

func (h *SceneHandler) AddEntity(c *gin.Context) {
	idStr := c.Param("id")
	sceneID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scene ID"})
		return
	}

	var req AddEntityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// デフォルト値を設定
	if req.AnimationKind == "" {
		req.AnimationKind = repo.GetNextAnimationKind()
	}

	entity := &domain.SceneEntity{
		SceneID:       uint(sceneID),
		ArtworkID:     req.ArtworkID,
		InitX:         req.InitX,
		InitY:         req.InitY,
		InitVX:        req.InitVX,
		InitVY:        req.InitVY,
		InitAngle:     req.InitAngle,
		InitScale:     req.InitScale,
		AnimationKind: req.AnimationKind,
		RNGSeed:       repo.GetRandomRNGSeed(),
	}

	if err := h.entityRepo.Create(entity); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add entity to scene"})
		return
	}

	// WebSocketでブロードキャスト
	room := fmt.Sprintf("scene:%d", sceneID)
	message := ws.Message{
		Type: "entity.add",
		Data: map[string]interface{}{
			"entity_id": entity.ID,
			"artwork_url": fmt.Sprintf("/download/%d", req.ArtworkID), // 簡易版
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

	h.hub.BroadcastToRoom(room, message)

	c.JSON(http.StatusOK, entity)
}

func (h *SceneHandler) ResetScene(c *gin.Context) {
	idStr := c.Param("id")
	sceneID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid scene ID"})
		return
	}

	if err := h.sceneRepo.ResetScene(uint(sceneID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reset scene"})
		return
	}

	// WebSocketでブロードキャスト
	room := fmt.Sprintf("scene:%d", sceneID)
	message := ws.Message{
		Type: "scene.reset",
		Data: map[string]interface{}{
			"hard": true,
		},
	}

	h.hub.BroadcastToRoom(room, message)

	c.JSON(http.StatusOK, gin.H{"message": "Scene reset successfully"})
}
