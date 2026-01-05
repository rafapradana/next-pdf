package handler

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/nextpdf/backend/internal/middleware"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/service"
)

type UploadHandler struct {
	uploadService *service.UploadService
}

func NewUploadHandler(uploadService *service.UploadService) *UploadHandler {
	return &UploadHandler{uploadService: uploadService}
}

func (h *UploadHandler) AvatarPresign(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req models.AvatarPresignRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	// Validation
	var validationErrors []models.ValidationError
	if req.Filename == "" {
		validationErrors = append(validationErrors, models.ValidationError{
			Field:   "filename",
			Message: "Filename is required",
		})
	}
	if req.FileSize <= 0 {
		validationErrors = append(validationErrors, models.ValidationError{
			Field:   "file_size",
			Message: "File size must be greater than 0",
		})
	}
	if req.ContentType == "" {
		validationErrors = append(validationErrors, models.ValidationError{
			Field:   "content_type",
			Message: "Content type is required",
		})
	}
	if len(validationErrors) > 0 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse(validationErrors))
	}

	response, err := h.uploadService.CreateAvatarPresignedUpload(c.Context(), userID, &req)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "invalid content type") {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"INVALID_FILE_TYPE",
				"Only JPEG, PNG, and WebP images are allowed",
			))
		}
		if strings.Contains(errMsg, "exceeds maximum") {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"FILE_TOO_LARGE",
				"File size exceeds the maximum limit of 5 MB",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to create upload URL",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(response, ""))
}

func (h *UploadHandler) AvatarConfirm(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req models.AvatarConfirmRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	avatarURL, err := h.uploadService.ConfirmAvatarUpload(c.Context(), userID, req.UploadID)
	if err != nil {
		if errors.Is(err, repository.ErrUploadNotFound) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"UPLOAD_NOT_FOUND",
				"Upload session not found or has expired",
			))
		}
		errMsg := err.Error()
		if strings.Contains(errMsg, "not found in storage") {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"FILE_NOT_IN_STORAGE",
				"File was not found in storage. Please retry the upload.",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to confirm upload",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(
		map[string]string{"avatar_url": avatarURL},
		"Avatar updated successfully",
	))
}
