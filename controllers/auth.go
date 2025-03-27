package controllers

import (
	"github.com/nbursa/decentralized-plenum/config"
	"github.com/nbursa/decentralized-plenum/models"
	"github.com/nbursa/decentralized-plenum/services"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"
)

func Register(c *fiber.Ctx) error {
	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request format"})
	}

	if input.Username == "" || input.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Missing username or password"})
	}

	var existingUser models.User
	if result := config.DB.Where("username = ?", input.Username).First(&existingUser); result.RowsAffected > 0 {
		// Fallback: check password for existing user
		if err := bcrypt.CompareHashAndPassword([]byte(existingUser.Password), []byte(input.Password)); err != nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "User exists, but password is incorrect",
			})
		}

		// Password correct – login and return token
		token, err := services.GenerateJWT(existingUser.Username)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not generate token"})
		}

		return c.JSON(fiber.Map{
			"message": "User already exists, logged in successfully",
			"token":   token,
		})
	}

	// Register new user
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Password encryption failed"})
	}

	user := models.User{Username: input.Username, Password: string(hashedPassword)}
	if result := config.DB.Create(&user); result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create user"})
	}

	token, err := services.GenerateJWT(user.Username)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not generate token"})
	}

	return c.JSON(fiber.Map{"message": "User registered successfully", "token": token})
}

func Login(c *fiber.Ctx) error {
	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := c.BodyParser(&input); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request"})
	}

	var user models.User
	if result := config.DB.Where("username = ?", input.Username).First(&user); result.Error != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	token, err := services.GenerateJWT(user.Username)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Could not generate token"})
	}

	return c.JSON(fiber.Map{"message": "Login successful", "token": token})
}

func GetUserProfile(c *fiber.Ctx) error {
	username := c.Params("username")

	var user models.User
	if result := config.DB.Where("username = ?", username).First(&user); result.Error != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{"username": user.Username})
}

func GetCurrentUser(c *fiber.Ctx) error {
	tokenString := c.Get("Authorization")
	if tokenString == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Missing token"})
	}

	tokenString = tokenString[len("Bearer "):]

	token, err := services.ParseJWT(tokenString)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "Invalid token"})
	}

	// Try DB lookup for full profile (avatar)
	var user models.User
	if result := config.DB.Where("username = ?", token.Username).First(&user); result.Error == nil {
		return c.JSON(fiber.Map{
			"username": user.Username,
			"avatar":   user.Avatar,
		})
	}

	// Fallback for anonymous users (no avatar)
	return c.JSON(fiber.Map{
		"username": token.Username,
	})
}


