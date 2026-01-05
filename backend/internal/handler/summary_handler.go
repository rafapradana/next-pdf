package handler

import (
	"errors"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/middleware"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/service"
)

type SummaryHandler struct {
	summaryService *service.SummaryService
}

func NewSummaryHandler(summaryService *service.SummaryService) *SummaryHandler {
	return &SummaryHandler{summaryService: summaryService}
}

func (h *SummaryHandler) GetByFileID(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("file_id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	// Parse version if provided
	var version *int
	if versionStr := c.Query("version"); versionStr != "" {
		if v, err := strconv.Atoi(versionStr); err == nil {
			version = &v
		}
	}

	summary, status, err := h.summaryService.GetByFileID(c.Context(), userID, fileID, version)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to get summary",
		))
	}

	// Return status response if no summary
	if status != nil {
		return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(status, ""))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(summary, ""))
}

func (h *SummaryHandler) GetHistory(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("file_id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	history, err := h.summaryService.GetHistory(c.Context(), userID, fileID)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to get summary history",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(history, ""))
}

func (h *SummaryHandler) Generate(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("file_id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	var req models.GenerateSummaryRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	// Validate style
	if req.Style == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "style", Message: "Summary style is required"},
		}))
	}

	// Validate custom instructions length
	if req.CustomInstructions != nil && len(*req.CustomInstructions) > 500 {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "custom_instructions", Message: "Custom instructions must not exceed 500 characters"},
		}))
	}

	response, err := h.summaryService.Generate(c.Context(), userID, fileID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		if errors.Is(err, service.ErrAlreadyProcessing) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"ALREADY_PROCESSING",
				"A summary is already being generated for this file",
			))
		}
		if errors.Is(err, service.ErrInvalidStyle) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"INVALID_STYLE",
				"Invalid summary style. Valid options: bullet_points, paragraph, detailed, executive, academic",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to generate summary",
		))
	}

	return c.Status(fiber.StatusAccepted).JSON(models.NewAPIResponse(response, ""))
}

func (h *SummaryHandler) GetStyles(c *fiber.Ctx) error {
	styles := h.summaryService.GetStyles()
	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(styles, ""))
}
