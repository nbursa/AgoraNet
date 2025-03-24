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

	if os.Getenv("HEROKU") == "" {
        if err := godotenv.Load(); err != nil {
            log.Fatal("Error loading .env file:", err)
        }
    }

	apiPort := os.Getenv("API_PORT")
	signalingPort := os.Getenv("SIGNALING_PORT")
	frontendURL := os.Getenv("FRONTEND_URL")
	dbType := os.Getenv("DB_TYPE")

	requiredVars := map[string]string{
		"API_PORT":       apiPort,
		"SIGNALING_PORT": signalingPort,
		"FRONTEND_URL":   frontendURL,
		"DB_TYPE":        dbType,
	}

	for key, value := range requiredVars {
		if value == "" {
			log.Fatalf("❌ Missing required environment variable: %s", key)
		}
	}

	log.Println("📦 Database type:", dbType)

	if err := config.InitDatabase(); err != nil {
		log.Fatal("❌ Database initialization failed:", err)
	}

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))

	// 🧠 Start signaling server in background (WebSocket)
	go services.StartSignalingServer(signalingPort)

	// 🧠 Setup Fiber API routes
	routes.SetupRoutes(app)

	// 🚀 Start HTTP API server
	go func() {
		log.Printf("🚀 Fiber API running on http://localhost:%s", apiPort)
		if err := app.Listen(":" + apiPort); err != nil {
			log.Fatal("❌ Failed to start API server:", err)
		}
	}()

	// 🧹 Handle graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down backend...")
}
