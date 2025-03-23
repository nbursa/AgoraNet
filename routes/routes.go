package routes

import (
	"fmt"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/nbursa/decentralized-plenum/controllers"
	"github.com/nbursa/decentralized-plenum/middleware"
)

func SetupRoutes(app *fiber.App) {
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

	api.Post("/votes", controllers.SyncVotes)

	fmt.Println("✅ API routes registered: /api/votes (POST)")
}
