package routes

import (
	"decentralized-plenum/controllers"
	"decentralized-plenum/middleware"
	"decentralized-plenum/services"
	"fmt"
	"net/http"
	"os"

	"github.com/gofiber/fiber/v2"
	socketio "github.com/googollee/go-socket.io"
)

func SetupRoutes(app *fiber.App, server *socketio.Server) {
	fmt.Println("🔧 Setting up routes...")

	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Decentralized Plenum API is running"})
	})

	auth := app.Group("/auth")
	auth.Post("/register", controllers.Register)
	auth.Post("/login", controllers.Login)
	auth.Get("/profile/:username", controllers.GetUserProfile)
	auth.Get("/me", controllers.GetCurrentUser)
	
	fmt.Println("✅ Auth routes registered: /auth/register, /auth/login, /auth/profile/:username")

	uploadDir := "./uploads/avatars"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		panic("Failed to create upload directory")
	}

	app.Static("/uploads/avatars", uploadDir)

	api := app.Group("/api", middleware.AuthMiddleware())
	api.Get("/protected", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "This is a protected route"})
	})

	app.Post("/create-room", func(c *fiber.Ctx) error {
		var req struct {
			RoomID string `json:"roomId"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if req.RoomID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Room ID is required"})
		}

		message, status := services.CreateRoom(req.RoomID, server)
		return c.Status(status).JSON(fiber.Map{"message": message})
	})

	app.Post("/close-room", func(c *fiber.Ctx) error {
		var req struct {
			RoomID string `json:"roomId"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if req.RoomID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Room ID is required"})
		}

		message, status := services.CloseRoom(req.RoomID, server)
		return c.Status(status).JSON(fiber.Map{"message": message})
	})

	go func() {
		httpServer := &http.Server{
			Addr:    ":3002",
			Handler: server,
		}
		fmt.Println("🚀 WebSocket server running on port 3002")
		if err := httpServer.ListenAndServe(); err != nil {
			fmt.Println("❌ WebSocket server error:", err)
		}
	}()

	for _, route := range app.Stack() {
		for _, routeItem := range route {
			fmt.Println("📌 Registered Route:", routeItem.Method, routeItem.Path)
		}
	}
}
