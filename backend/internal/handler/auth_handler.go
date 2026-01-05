package handler

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/nextpdf/backend/internal/middleware"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/service"
)

type AuthHandler struct {
	authService *service.AuthService
}

func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	// Basic validation
	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "email", Message: "Email is required"},
			{Field: "password", Message: "Password is required"},
		}))
	}

	if len(req.Password) < 8 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "password", Message: "Password must be at least 8 characters"},
		}))
	}

	user, err := h.authService.Register(c.Context(), &req)
	if err != nil {
		if errors.Is(err, repository.ErrEmailExists) {
			return c.Status(fiber.StatusConflict).JSON(models.NewErrorResponse(
				"EMAIL_EXISTS",
				"An account with this email already exists",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to create account",
		))
	}

	return c.Status(fiber.StatusCreated).JSON(models.NewAPIResponse(
		user.ToResponse(),
		"Registration successful. Please verify your email.",
	))
}

func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	deviceInfo := c.Get("User-Agent")
	ipAddress := c.IP()

	response, refreshToken, err := h.authService.Login(c.Context(), &req, deviceInfo, ipAddress)
	if err != nil {
		if errors.Is(err, service.ErrInvalidCredentials) {
			return c.Status(fiber.StatusUnauthorized).JSON(models.NewErrorResponse(
				"INVALID_CREDENTIALS",
				"Invalid email or password",
			))
		}
		if errors.Is(err, service.ErrAccountDisabled) {
			return c.Status(fiber.StatusForbidden).JSON(models.NewErrorResponse(
				"ACCOUNT_DISABLED",
				"Your account has been deactivated. Please contact support.",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to login",
		))
	}

	// Set refresh token cookie
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/api/v1/auth",
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(response, ""))
}

func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(models.NewErrorResponse(
			"TOKEN_EXPIRED",
			"Refresh token not found. Please login again.",
		))
	}

	response, newRefreshToken, err := h.authService.RefreshToken(c.Context(), refreshToken)
	if err != nil {
		if errors.Is(err, service.ErrInvalidToken) {
			return c.Status(fiber.StatusUnauthorized).JSON(models.NewErrorResponse(
				"TOKEN_REUSE_DETECTED",
				"Suspicious activity detected. All sessions have been terminated. Please login again.",
			))
		}
		if errors.Is(err, service.ErrTokenExpired) {
			return c.Status(fiber.StatusUnauthorized).JSON(models.NewErrorResponse(
				"TOKEN_EXPIRED",
				"Refresh token has expired. Please login again.",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to refresh token",
		))
	}

	// Set new refresh token cookie
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		Path:     "/api/v1/auth",
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(response, ""))
}

func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	refreshToken := c.Cookies("refresh_token")
	if refreshToken != "" {
		_ = h.authService.Logout(c.Context(), refreshToken)
	}

	// Clear cookie
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/v1/auth",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(nil, "Successfully logged out"))
}

func (h *AuthHandler) LogoutAll(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	count, err := h.authService.LogoutAll(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to logout from all devices",
		))
	}

	// Clear cookie
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/v1/auth",
		Expires:  time.Now().Add(-time.Hour),
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(
		models.LogoutAllResponse{SessionsTerminated: int(count)},
		"Successfully logged out from all devices",
	))
}
