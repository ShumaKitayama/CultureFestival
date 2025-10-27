package domain

import "time"

type Scene struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:100;not null"`
	Width     int       `json:"width" gorm:"not null"`
	Height    int       `json:"height" gorm:"not null"`
	CreatedAt time.Time `json:"created_at"`
	
	// リレーション
	Entities     []SceneEntity  `json:"entities" gorm:"foreignKey:SceneID"`
	DisplayNodes []DisplayNode  `json:"display_nodes" gorm:"foreignKey:SceneID"`
}

type SceneEntity struct {
	ID            uint    `json:"id" gorm:"primaryKey"`
	SceneID       uint    `json:"scene_id" gorm:"not null;index"`
	ArtworkID     uint    `json:"artwork_id" gorm:"not null"`
	InitX         float64 `json:"init_x" gorm:"not null"`
	InitY         float64 `json:"init_y" gorm:"not null"`
	InitVX        float64 `json:"init_vx" gorm:"not null"`
	InitVY        float64 `json:"init_vy" gorm:"not null"`
	InitAngle     float64 `json:"init_angle" gorm:"not null;default:0"`
	InitScale     float64 `json:"init_scale" gorm:"not null;default:1"`
	AnimationKind string  `json:"animation_kind" gorm:"type:enum('pulsate','disperse','explode','spin_fight','stream_in');not null"`
	RNGSeed       int64   `json:"rng_seed" gorm:"not null"`
	CreatedAt     time.Time `json:"created_at"`
	
	// リレーション
	Scene   Scene   `json:"scene" gorm:"foreignKey:SceneID"`
	Artwork Artwork `json:"artwork" gorm:"foreignKey:ArtworkID"`
}

type DisplayNode struct {
	ID           uint    `json:"id" gorm:"primaryKey"`
	SceneID      uint    `json:"scene_id" gorm:"not null;index"`
	Name         string  `json:"name" gorm:"size:100;not null"`
	ViewportX    int     `json:"viewport_x" gorm:"not null"`
	ViewportY    int     `json:"viewport_y" gorm:"not null"`
	ViewportW    int     `json:"viewport_w" gorm:"not null"`
	ViewportH    int     `json:"viewport_h" gorm:"not null"`
	Scale        float64 `json:"scale" gorm:"not null;default:1"`
	PixelWidth   int     `json:"pixel_width" gorm:"not null"`
	PixelHeight  int     `json:"pixel_height" gorm:"not null"`
	DeviceKey    string  `json:"device_key" gorm:"size:40;uniqueIndex;not null"`
	CreatedAt    time.Time `json:"created_at"`
	
	// リレーション
	Scene Scene `json:"scene" gorm:"foreignKey:SceneID"`
}
