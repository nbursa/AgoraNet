package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/joho/godotenv"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	ws "github.com/gofiber/websocket/v2"

	"github.com/nbursa/agoranet/config"
	"github.com/nbursa/agoranet/routes"
	"github.com/nbursa/agoranet/services"
)

func main() {
	fmt.Println("Starting AgoraNet Backend...")

	if os.Getenv("DYNO") == "" {
		if err := godotenv.Load(); err != nil {
			log.Fatal("Error loading .env file:", err)
		}
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	signalPort := os.Getenv("SIGNALING_PORT")
	if signalPort == "" {
		signalPort = "8081"
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

	app := fiber.New()

	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))

	app.Options("/*", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	// 🔗 Register HTTP routes
	routes.SetupRoutes(app)

	// ✅ WebSocket endpoints (Fiber-native)
	app.Use("/ws", func(c *fiber.Ctx) error {
		if ws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws", ws.New(services.HandleWebSocket))

	app.Use("/dashboard", func(c *fiber.Ctx) error {
		if ws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/dashboard", ws.New(services.HandleDashboardSocket))

	// 🌍 Start server
	if os.Getenv("DYNO") != "" {
		log.Printf("🚀 Running on Heroku shared port: %s", port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatalf("❌ Fiber failed: %v", err)
		}
	} else {
		// Local dev: run WebSocket on separate port
		go services.StartSignalingServer(signalPort)

		log.Printf("🚀 Fiber running on http://localhost:%s", port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatal("❌ Fiber failed:", err)
		}
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down server...")
}
