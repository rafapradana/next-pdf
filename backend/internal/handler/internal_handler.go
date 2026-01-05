package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/service"
)

type InternalHandler struct {
	summaryService *service.SummaryService
}

func NewInternalHandler(summaryService *service.SummaryService) *InternalHandler {
	return &InternalHandler{summaryService: summaryService}
}

// SummaryCallback handles callbacks from the AI service
func (h *InternalHandler) SummaryCallback(c *fiber.Ctx) error {
	var req models.SummaryCallbackRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	fileID, err := uuid.Parse(req.FileID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	if req.Status == "completed" {
		err = h.summaryService.ProcessCallback(c.Context(), fileID, &req)
	} else {
		err = h.summaryService.ProcessErrorCallback(c.Context(), fileID, req.ErrorMessage)
	}

	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to process callback",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(nil, "Callback processed"))
}
