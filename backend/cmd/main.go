package main

import (
	"log"
	"os"

	"decentralized-plenum/config"
	"decentralized-plenum/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// Initialize Database
	config.InitDatabase()

	app := fiber.New()
	routes.SetupRoutes(app)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}
