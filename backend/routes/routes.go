package routes

import (
	"decentralized-plenum/controllers"
	"decentralized-plenum/middleware"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App) {
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
}
