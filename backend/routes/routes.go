package routes

import (
	"decentralized-plenum/controllers"
	"decentralized-plenum/middleware"
	"decentralized-plenum/services"

	"github.com/gofiber/fiber/v2"
	socketio "github.com/googollee/go-socket.io"
)

func SetupRoutes(app *fiber.App, server *socketio.Server) {
	app.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "Decentralized Plenum API is running"})
	})

	// Authentication
	app.Post("/auth/register", controllers.Register)
	app.Post("/auth/login", controllers.Login)

	// 🔒 Protected route
	api := app.Group("/api", middleware.AuthMiddleware())
	api.Get("/protected", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"message": "This is a protected route"})
	})

	// ✅ API to close a room
	app.Post("/close-room", func(c *fiber.Ctx) error {
		var req struct {
			Room string `json:"roomId"`
		}
		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if req.Room == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Room ID is required"})
		}

		message, status := services.CloseRoom(req.Room, server)
		return c.Status(status).JSON(fiber.Map{"message": message})
	})
}
