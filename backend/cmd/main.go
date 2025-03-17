package main

import (
	"log"
	"os"

	"decentralized-plenum/config"
	"decentralized-plenum/routes"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// 🛠️ Initialize Database (USE InitDatabase, NOT ConnectDatabase)
	config.InitDatabase()

	app := fiber.New()

	// Enable CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:3000",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Content-Type, Authorization",
	}))

	routes.SetupRoutes(app)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Fatal(app.Listen(":" + port))
}
