package config

import (
	"fmt"
	"os"

	"github.com/nbursa/decentralized-plenum/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDatabase() error {
	var err error
	dbType := os.Getenv("DB_TYPE")
	dbPath := os.Getenv("DB_PATH")

	if dbType == "sqlite" {
		DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
		if err != nil {
			return fmt.Errorf("failed to connect to database: %w", err)
		}
	} else {
		return fmt.Errorf("unsupported database type: %s", dbType)
	}

	fmt.Println("✅ Database connected!")
	DB.AutoMigrate(&models.User{}, &models.Vote{})
	return nil
}
