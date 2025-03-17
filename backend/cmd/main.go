package main

import (
	"log"
	"os"

	"decentralized-plenum/config"
	"decentralized-plenum/routes"
	"decentralized-plenum/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	// 🛠️ Initialize Database
	config.InitDatabase()

	// Start WebRTC Signaling Server in a Goroutine
	go services.StartSignalingServer()

	// Fiber Web API server
	app := fiber.New()

	// Enable CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins: "http://localhost:3000",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Content-Type, Authorization",
	}))

	// Setup API routes
	routes.SetupRoutes(app)

	// Start the Fiber API server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("🚀 Backend API running on http://localhost:%s", port)
	log.Fatal(app.Listen(":" + port))
}
