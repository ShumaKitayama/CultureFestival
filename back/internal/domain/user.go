package domain

import "time"

type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:100;not null"`
	CreatedAt time.Time `json:"created_at"`
}

type APIKey struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:100;not null"`
	Token     string    `json:"token" gorm:"size:40;uniqueIndex;not null"`
	Role      string    `json:"role" gorm:"type:enum('upload','display','ops');not null"`
	CreatedAt time.Time `json:"created_at"`
}
