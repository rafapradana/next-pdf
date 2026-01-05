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

type FolderHandler struct {
	folderService *service.FolderService
}

func NewFolderHandler(folderService *service.FolderService) *FolderHandler {
	return &FolderHandler{folderService: folderService}
}

func (h *FolderHandler) GetTree(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	includeFiles := c.QueryBool("include_files", false)
	includeCounts := c.QueryBool("include_counts", true)

	tree, err := h.folderService.GetTree(c.Context(), userID, includeFiles, includeCounts)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to get folder tree",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(tree, ""))
}

func (h *FolderHandler) Create(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req models.CreateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	if req.Name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "name", Message: "Folder name is required"},
		}))
	}

	folder, err := h.folderService.Create(c.Context(), userID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrFolderExists) {
			return c.Status(fiber.StatusConflict).JSON(models.NewErrorResponse(
				"FOLDER_EXISTS",
				"A folder with this name already exists in the selected location",
			))
		}
		if errors.Is(err, repository.ErrFolderNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"PARENT_NOT_FOUND",
				"Parent folder not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to create folder",
		))
	}

	return c.Status(fiber.StatusCreated).JSON(models.NewAPIResponse(folder, "Folder created successfully"))
}

func (h *FolderHandler) Update(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	folderIDStr := c.Params("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid folder ID",
		))
	}

	var req models.UpdateFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	if req.Name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "name", Message: "Folder name is required"},
		}))
	}

	folder, err := h.folderService.Update(c.Context(), userID, folderID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrFolderNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FOLDER_NOT_FOUND",
				"Folder not found",
			))
		}
		if errors.Is(err, repository.ErrFolderExists) {
			return c.Status(fiber.StatusConflict).JSON(models.NewErrorResponse(
				"FOLDER_EXISTS",
				"A folder with this name already exists in the selected location",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to update folder",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(folder, "Folder renamed successfully"))
}

func (h *FolderHandler) Move(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	folderIDStr := c.Params("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid folder ID",
		))
	}

	var req models.MoveFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	folder, err := h.folderService.Move(c.Context(), userID, folderID, &req)
	if err != nil {
		if errors.Is(err, repository.ErrFolderNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FOLDER_NOT_FOUND",
				"Folder not found",
			))
		}
		if errors.Is(err, repository.ErrInvalidMove) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"INVALID_MOVE",
				"Cannot move folder into itself or its descendants",
			))
		}
		if errors.Is(err, repository.ErrCircularReference) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"CIRCULAR_REFERENCE",
				"Moving this folder would create a circular reference",
			))
		}
		if errors.Is(err, repository.ErrFolderExists) {
			return c.Status(fiber.StatusConflict).JSON(models.NewErrorResponse(
				"FOLDER_EXISTS",
				"A folder with this name already exists in the target location",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to move folder",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(folder, "Folder moved successfully"))
}

func (h *FolderHandler) Delete(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	folderIDStr := c.Params("id")
	folderID, err := uuid.Parse(folderIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid folder ID",
		))
	}

	err = h.folderService.Delete(c.Context(), userID, folderID)
	if err != nil {
		if errors.Is(err, repository.ErrFolderNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FOLDER_NOT_FOUND",
				"Folder not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to delete folder",
		))
	}

	return c.SendStatus(fiber.StatusNoContent)
}
