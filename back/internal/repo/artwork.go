package repo

import (
	"culture-festival-backend/internal/domain"
	"math/rand"
	"time"

	"gorm.io/gorm"
)

type ArtworkRepository struct {
	db *gorm.DB
}

func NewArtworkRepository(db *gorm.DB) *ArtworkRepository {
	return &ArtworkRepository{db: db}
}

func (r *ArtworkRepository) Create(artwork *domain.Artwork) error {
	return r.db.Create(artwork).Error
}

func (r *ArtworkRepository) GetByID(id uint) (*domain.Artwork, error) {
	var artwork domain.Artwork
	err := r.db.Preload("Asset").Preload("User").First(&artwork, id).Error
	if err != nil {
		return nil, err
	}
	return &artwork, nil
}

func (r *ArtworkRepository) GetByQRToken(token string) (*domain.Artwork, error) {
	var artwork domain.Artwork
	err := r.db.Preload("Asset").Preload("User").Where("qr_token = ?", token).First(&artwork).Error
	if err != nil {
		return nil, err
	}
	return &artwork, nil
}

func (r *ArtworkRepository) GetAll() ([]domain.Artwork, error) {
	var artworks []domain.Artwork
	err := r.db.Preload("Asset").Preload("User").Find(&artworks).Error
	return artworks, err
}

func (r *ArtworkRepository) Delete(id uint) error {
	return r.db.Delete(&domain.Artwork{}, id).Error
}

func (r *ArtworkRepository) List(limit, offset int) ([]domain.Artwork, error) {
	var artworks []domain.Artwork
	err := r.db.Preload("Asset").Preload("User").
		Order("created_at DESC").
		Limit(limit).Offset(offset).
		Find(&artworks).Error
	return artworks, err
}

type AssetRepository struct {
	db *gorm.DB
}

func NewAssetRepository(db *gorm.DB) *AssetRepository {
	return &AssetRepository{db: db}
}

func (r *AssetRepository) Create(asset *domain.Asset) error {
	return r.db.Create(asset).Error
}

func (r *AssetRepository) GetBySHA256(sha256 string) (*domain.Asset, error) {
	var asset domain.Asset
	err := r.db.Where("sha256 = ?", sha256).First(&asset).Error
	if err != nil {
		return nil, err
	}
	return &asset, nil
}

func (r *AssetRepository) GetByID(id uint) (*domain.Asset, error) {
	var asset domain.Asset
	err := r.db.First(&asset, id).Error
	if err != nil {
		return nil, err
	}
	return &asset, nil
}

// アニメーション種類のラウンドロビン
var animationKinds = []string{"pulsate", "disperse", "explode", "spin_fight", "stream_in"}
var animationIndex = 0

func GetNextAnimationKind() string {
	kind := animationKinds[animationIndex]
	animationIndex = (animationIndex + 1) % len(animationKinds)
	return kind
}

func GetRandomRNGSeed() int64 {
	return rand.New(rand.NewSource(time.Now().UnixNano())).Int63()
}
