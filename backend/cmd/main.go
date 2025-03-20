package main

import (
	"fmt"
	"log"
	"os"

	"decentralized-plenum/config"
	"decentralized-plenum/routes"
	"decentralized-plenum/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	socketio "github.com/googollee/go-socket.io"
	"github.com/joho/godotenv"
)

func main() {
    fmt.Println("Starting Decentralized Plenum Backend...")

    if err := godotenv.Load(); err != nil {
        log.Fatal("Error loading .env file:", err)
    }

    apiPort := os.Getenv("API_PORT")
    signalingPort := os.Getenv("SIGNALING_PORT")
    websocketPort := os.Getenv("WS_PORT")
    frontendURL := os.Getenv("FRONTEND_URL")
    dbType := os.Getenv("DB_TYPE")

    requiredVars := map[string]string{
        "API_PORT":        apiPort,
        "SIGNALING_PORT":  signalingPort,
        "WS_PORT":         websocketPort,
        "FRONTEND_URL":    frontendURL,
        "DB_TYPE":         dbType,
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

    server := socketio.NewServer(nil)
    routes.SetupRoutes(app, server)

    go func() {
        log.Printf("🚀 Fiber API running on http://localhost:%s", apiPort)
        if err := app.Listen(":" + apiPort); err != nil {
            log.Fatal("❌ Failed to start server:", err)
        }
    }()

    go func() {
        services.StartSignalingServer(signalingPort, server)
    }()
}