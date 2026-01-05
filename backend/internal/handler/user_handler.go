package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/middleware"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/service"
)

type UserHandler struct {
	userService *service.UserService
}

func NewUserHandler(userService *service.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

func (h *UserHandler) GetMe(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	user, err := h.userService.GetByID(c.Context(), userID)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"NOT_FOUND",
				"User not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to get user profile",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(user.ToResponse(), ""))
}

func (h *UserHandler) UpdateMe(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req models.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	user, err := h.userService.UpdateProfile(c.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"NOT_FOUND",
				"User not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to update profile",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(
		user.ToResponse(),
		"Profile updated successfully",
	))
}

func (h *UserHandler) ChangePassword(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req models.ChangePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	// Validation
	var validationErrors []models.ValidationError
	if len(req.NewPassword) < 8 {
		validationErrors = append(validationErrors, models.ValidationError{
			Field:   "new_password",
			Message: "Password must be at least 8 characters",
		})
	}
	if req.NewPassword != req.NewPasswordConfirmation {
		validationErrors = append(validationErrors, models.ValidationError{
			Field:   "new_password_confirmation",
			Message: "Password confirmation does not match",
		})
	}
	if len(validationErrors) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse(validationErrors))
	}

	err := h.userService.ChangePassword(c.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, service.ErrInvalidPassword) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"INVALID_PASSWORD",
				"Current password is incorrect",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to change password",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(nil, "Password changed successfully"))
}

func (h *UserHandler) GetSessions(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	// Get current token ID from cookie for marking current session
	// This is simplified - in production you'd track this properly
	sessions, err := h.userService.GetSessions(c.Context(), userID, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to get sessions",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(sessions, ""))
}

func (h *UserHandler) RevokeSession(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	sessionIDStr := c.Params("session_id")
	sessionID, err := uuid.Parse(sessionIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid session ID",
		))
	}

	err = h.userService.RevokeSession(c.Context(), userID, sessionID)
	if err != nil {
		if errors.Is(err, repository.ErrSessionNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"SESSION_NOT_FOUND",
				"Session not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to revoke session",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(nil, "Session revoked successfully"))
}
