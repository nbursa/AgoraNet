package config

import (
	"decentralized-plenum/models"
	"fmt"
	"log"
	"os"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDatabase() {
	var err error
	dbType := os.Getenv("DB_TYPE")

	if dbType == "sqlite" {
		DB, err = gorm.Open(sqlite.Open(os.Getenv("DB_PATH")), &gorm.Config{})
	} else {
		log.Fatal("Unsupported database type")
	}

	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	fmt.Println("Database connected!")
	DB.AutoMigrate(&models.User{})
}
