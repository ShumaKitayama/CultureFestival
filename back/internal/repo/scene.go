package repo

import (
	"culture-festival-backend/internal/domain"
	"math/rand"

	"gorm.io/gorm"
)

type SceneRepository struct {
	db *gorm.DB
}

func NewSceneRepository(db *gorm.DB) *SceneRepository {
	return &SceneRepository{db: db}
}

func (r *SceneRepository) Create(scene *domain.Scene) error {
	return r.db.Create(scene).Error
}

func (r *SceneRepository) GetByID(id uint) (*domain.Scene, error) {
	var scene domain.Scene
	err := r.db.Preload("Entities.Artwork.Asset").Preload("DisplayNodes").First(&scene, id).Error
	if err != nil {
		return nil, err
	}
	return &scene, nil
}

func (r *SceneRepository) List() ([]domain.Scene, error) {
	var scenes []domain.Scene
	err := r.db.Find(&scenes).Error
	return scenes, err
}

func (r *SceneRepository) AddEntity(entity *domain.SceneEntity) error {
	return r.db.Create(entity).Error
}

func (r *SceneRepository) GetEntitiesBySceneID(sceneID uint) ([]domain.SceneEntity, error) {
	var entities []domain.SceneEntity
	err := r.db.Preload("Artwork.Asset").Where("scene_id = ?", sceneID).Find(&entities).Error
	return entities, err
}

func (r *SceneRepository) ResetScene(sceneID uint) error {
	return r.db.Where("scene_id = ?", sceneID).Delete(&domain.SceneEntity{}).Error
}

type SceneEntityRepository struct {
	db *gorm.DB
}

func NewSceneEntityRepository(db *gorm.DB) *SceneEntityRepository {
	return &SceneEntityRepository{db: db}
}

func (r *SceneEntityRepository) Create(entity *domain.SceneEntity) error {
	return r.db.Create(entity).Error
}

func (r *SceneEntityRepository) GetBySceneID(sceneID uint) ([]domain.SceneEntity, error) {
	var entities []domain.SceneEntity
	err := r.db.Preload("Artwork.Asset").Where("scene_id = ?", sceneID).Find(&entities).Error
	return entities, err
}

func (r *SceneEntityRepository) DeleteBySceneID(sceneID uint) error {
	return r.db.Where("scene_id = ?", sceneID).Delete(&domain.SceneEntity{}).Error
}

type DisplayNodeRepository struct {
	db *gorm.DB
}

func NewDisplayNodeRepository(db *gorm.DB) *DisplayNodeRepository {
	return &DisplayNodeRepository{db: db}
}

func (r *DisplayNodeRepository) Create(node *domain.DisplayNode) error {
	return r.db.Create(node).Error
}

func (r *DisplayNodeRepository) GetByDeviceKey(deviceKey string) (*domain.DisplayNode, error) {
	var node domain.DisplayNode
	err := r.db.Preload("Scene").Where("device_key = ?", deviceKey).First(&node).Error
	if err != nil {
		return nil, err
	}
	return &node, nil
}

func (r *DisplayNodeRepository) GetBySceneID(sceneID uint) ([]domain.DisplayNode, error) {
	var nodes []domain.DisplayNode
	err := r.db.Where("scene_id = ?", sceneID).Find(&nodes).Error
	return nodes, err
}

func (r *DisplayNodeRepository) List() ([]domain.DisplayNode, error) {
	var nodes []domain.DisplayNode
	err := r.db.Preload("Scene").Find(&nodes).Error
	return nodes, err
}

// ランダムな初期位置と速度を生成
func GenerateRandomPositionAndVelocity(sceneWidth, sceneHeight int) (x, y, vx, vy float64) {
	// 画面の中央付近に配置
	margin := 100.0
	x = float64(sceneWidth)/2 + (rand.Float64()-0.5)*(float64(sceneWidth)/2-margin)
	y = float64(sceneHeight)/2 + (rand.Float64()-0.5)*(float64(sceneHeight)/2-margin)
	
	// ランダムな速度（-2から2の範囲）
	vx = (rand.Float64() - 0.5) * 4
	vy = (rand.Float64() - 0.5) * 4
	
	return x, y, vx, vy
}
