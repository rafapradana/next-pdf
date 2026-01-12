package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/service"
)

const (
	UserIDKey    = "userID"
	UserEmailKey = "userEmail"
)

func AuthMiddleware(authService *service.AuthService) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var token string

		// 1. Try Header
		authHeader := c.Get("Authorization")
		if authHeader != "" {
			parts := strings.Split(authHeader, " ")
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				token = parts[1]
			}
		}

		// 2. Try Query Param (for SSE/WS)
		if token == "" {
			token = c.Query("token")
		}

		if token == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(models.NewErrorResponse(
				"UNAUTHORIZED",
				"Missing or invalid authorization",
			))
		}
		claims, err := authService.ValidateAccessToken(token)
		if err != nil {
			if err == service.ErrTokenExpired {
				return c.Status(fiber.StatusUnauthorized).JSON(models.NewErrorResponse(
					"TOKEN_EXPIRED",
					"Access token has expired. Please refresh your token.",
				))
			}
			return c.Status(fiber.StatusUnauthorized).JSON(models.NewErrorResponse(
				"UNAUTHORIZED",
				"Invalid access token",
			))
		}

		c.Locals(UserIDKey, claims.UserID)
		c.Locals(UserEmailKey, claims.Email)

		return c.Next()
	}
}

func GetUserID(c *fiber.Ctx) uuid.UUID {
	userID, ok := c.Locals(UserIDKey).(uuid.UUID)
	if !ok {
		return uuid.Nil
	}
	return userID
}

func GetUserEmail(c *fiber.Ctx) string {
	email, ok := c.Locals(UserEmailKey).(string)
	if !ok {
		return ""
	}
	return email
}
