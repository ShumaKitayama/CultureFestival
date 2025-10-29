package domain

import (
	"encoding/json"
	"time"
)

type Asset struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Path      string    `json:"path" gorm:"size:255;not null"`
	Mime      string    `json:"mime" gorm:"size:64;not null"`
	Width     int       `json:"width" gorm:"not null"`
	Height    int       `json:"height" gorm:"not null"`
	Bytes     int       `json:"bytes" gorm:"not null"`
	SHA256    string    `json:"sha256" gorm:"size:64;uniqueIndex;not null"`
	CreatedAt time.Time `json:"created_at"`
}

type Artwork struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	AssetID   uint      `json:"asset_id" gorm:"not null"`
	UserID    *uint     `json:"user_id"`
	Title     *string   `json:"title" gorm:"size:120"`
	Tags      *json.RawMessage `json:"tags" gorm:"type:jsonb"`
	QRToken   string    `json:"qr_token" gorm:"size:48;uniqueIndex;not null"`
	ThumbPath string    `json:"thumb_path" gorm:"size:255;not null"`
	CreatedAt time.Time `json:"created_at"`
	
	// リレーション
	Asset Asset `json:"asset" gorm:"foreignKey:AssetID"`
	User  *User `json:"user" gorm:"foreignKey:UserID"`
}
