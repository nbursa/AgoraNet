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

	// Create listener on same port
	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("❌ Failed to listen on port %s: %v", port, err)
	}

	// Setup Fiber
	app := fiber.New()
	app.Use(cors.New(cors.Config{
		AllowOrigins:     frontendURL,
		AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
		AllowHeaders:     "Content-Type, Authorization",
		AllowCredentials: true,
	}))
	routes.SetupRoutes(app)

	// Serve Fiber
	go func() {
		log.Printf("🚀 Fiber API running on http://localhost:%s", port)
		if err := app.Listener(ln); err != nil {
			log.Fatalf("❌ Fiber failed: %v", err)
		}
	}()

	// Serve WebSockets
	go func() {
		log.Printf("🔌 WebSocket routes attached on /ws and /dashboard")
		http.HandleFunc("/ws", services.HandleWebSocket)
		http.HandleFunc("/dashboard", services.HandleDashboardSocket)
		if err := http.Serve(ln, nil); err != nil {
			log.Fatalf("❌ WebSocket server failed: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit
	log.Println("🛑 Shutting down...")
}
