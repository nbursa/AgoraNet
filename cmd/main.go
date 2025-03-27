package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"

	"github.com/nbursa/decentralized-plenum/config"
	"github.com/nbursa/decentralized-plenum/routes"
	"github.com/nbursa/decentralized-plenum/services"
)

func main() {
	fmt.Println("Starting Decentralized Plenum Backend...")

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

	// ✅ Handle preflight OPTIONS globally
	app.Options("/*", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	routes.SetupRoutes(app)

	if os.Getenv("DYNO") != "" {
		ln, err := net.Listen("tcp", ":"+port)
		if err != nil {
			log.Fatalf("❌ Failed to listen: %v", err)
		}

		go func() {
			log.Printf("🚀 Fiber running on http://localhost:%s", port)
			if err := app.Listener(ln); err != nil {
				log.Fatalf("❌ Fiber failed: %v", err)
			}
		}()

		go func() {
			mux := http.NewServeMux()
			mux.HandleFunc("/ws", services.HandleWebSocket)
			mux.HandleFunc("/dashboard", services.HandleDashboardSocket)
			if err := http.Serve(ln, mux); err != nil {
				log.Fatalf("❌ WebSocket server failed: %v", err)
			}
		}()
	} else {
		go services.StartSignalingServer(signalPort)

		log.Printf("🚀 Fiber running on http://localhost:%s", port)
		if err := app.Listen(":" + port); err != nil {
			log.Fatal("❌ Fiber failed:", err)
		}
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down server...")
}
