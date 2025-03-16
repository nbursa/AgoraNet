package services

import (
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// UserClaims represents the JWT claims
type UserClaims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

// GenerateJWT generates a JWT token for a user
func GenerateJWT(username string) (string, error) {
	secretKey := []byte(os.Getenv("JWT_SECRET"))
	claims := UserClaims{
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour * 24)), // Token expires in 24h
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secretKey)
}

// HashPassword hashes a plaintext password
func HashPassword(password string) (string, error) {
	bytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(bytes), err
}

// CheckPassword compares a plaintext password with a hashed password
func CheckPassword(hashedPwd, plainPwd string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(plainPwd))
	return err == nil
}
