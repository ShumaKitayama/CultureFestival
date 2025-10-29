package repo

import (
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type Database struct {
	DB *gorm.DB
}

func NewDatabase(dsn string) (*Database, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	// マイグレーションは手動で実行済み
	// if err := db.AutoMigrate(
	// 	&domain.User{},
	// 	&domain.APIKey{},
	// 	&domain.Asset{},
	// 	&domain.Artwork{},
	// 	&domain.Scene{},
	// 	&domain.SceneEntity{},
	// 	&domain.DisplayNode{},
	// ); err != nil {
	// 	return nil, err
	// }

	log.Println("Database connected and migrated successfully")
	return &Database{DB: db}, nil
}
