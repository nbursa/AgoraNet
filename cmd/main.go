package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/nbursa/decentralized-plenum/config"
	"github.com/nbursa/decentralized-plenum/routes"
	"github.com/nbursa/decentralized-plenum/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
)

func main() {
	fmt.Println("Starting Decentralized Plenum Backend...")

	// Load .env file only if not on Heroku
	if os.Getenv("DYNO") == "" { // Check if running on Heroku by checking for the DYNO variable
		if err := godotenv.Load(); err != nil {
			log.Fatal("Error loading .env file:", err)
		}
	}

	// Get port dynamically assigned by Heroku, or default to 8080 locally
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Retrieve other environment variables
	signalingPort := os.Getenv("SIGNALING_PORT")
	frontendURL := os.Getenv("FRONTEND_URL")
	dbType := os.Getenv("DB_TYPE")

	requiredVars := map[string]string{
		"SIGNALING_PORT": signalingPort,
		"FRONTEND_URL":   frontendURL,
		"DB_TYPE":        dbType,
	}

	// Check if required environment variables are set
	for key, value := range requiredVars {
		if value == "" {
			log.Fatalf("❌ Missing required environment variable: %s", key)
		}
	}

	log.Println("📦 Database type:", dbType)

	// Initialize the database
	if err := config.InitDatabase(); err != nil {
		log.Fatal("❌ Database initialization failed:", err)
	}

	// Set up the Fiber app
	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))

	// Start signaling server in the background (WebSocket)
	go services.StartSignalingServer(signalingPort)

	// Set up API routes
	routes.SetupRoutes(app)

	// Start the HTTP API server, binding to the dynamic port on Heroku or default to 8080 locally
	log.Printf("🚀 Fiber API running on http://localhost:%s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatal("❌ Failed to start API server:", err)
	}

	// Handle graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down backend...")
}
