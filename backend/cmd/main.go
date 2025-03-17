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
	// ✅ Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Fatal("❌ Error loading .env file")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// ✅ Debug: Print database type
	log.Println("Database type:", os.Getenv("DB_TYPE"))

	// Initialize Database
	config.InitDatabase()

	// Start WebRTC Signaling Server
	server := services.StartSignalingServer()

	// Fiber Web API server
	app := fiber.New()

	// Enable CORS
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowMethods: "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders: "Content-Type, Authorization",
		AllowCredentials: true,
	}))

	// Setup API routes with socket server
	routes.SetupRoutes(app, server)

	// Start Fiber API
	log.Printf("🚀 Backend API running on http://localhost:%s", port)
	log.Fatal(app.Listen(":" + port))
}
