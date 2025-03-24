package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"

	"github.com/nbursa/decentralized-plenum/config"
	"github.com/nbursa/decentralized-plenum/routes"
	"github.com/nbursa/decentralized-plenum/services"
)

func main() {
	fmt.Println("Starting Decentralized Plenum Backend...")

	// Load .env locally (not on Heroku)
	if os.Getenv("DYNO") == "" {
		if err := godotenv.Load(); err != nil {
			log.Fatal("Error loading .env file:", err)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	signalingPort := os.Getenv("SIGNALING_PORT")
	if signalingPort == "" {
		signalingPort = "8081"
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	dbType := os.Getenv("DB_TYPE")

	required := map[string]string{
		"FRONTEND_URL": frontendURL,
		"DB_TYPE":      dbType,
	}

	for key, val := range required {
		if val == "" {
			log.Fatalf("❌ Missing required env: %s", key)
		}
	}

	log.Println("📦 DB Type:", dbType)

	if err := config.InitDatabase(); err != nil {
		log.Fatal("❌ DB init failed:", err)
	}

	// Start WebSocket server in background
	go services.StartSignalingServer(signalingPort)

	// Start Fiber HTTP API
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))

	routes.SetupRoutes(app)

	log.Printf("🚀 Fiber API running on http://localhost:%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("❌ Failed to start Fiber server:", err)
	}
}
