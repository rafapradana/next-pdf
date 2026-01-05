package handler

import (
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/middleware"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/service"
)

type FileHandler struct {
	fileService *service.FileService
}

func NewFileHandler(fileService *service.FileService) *FileHandler {
	return &FileHandler{fileService: fileService}
}

func (h *FileHandler) List(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	params := repository.FileListParams{
		UserID: userID,
		Sort:   c.Query("sort", "-uploaded_at"),
		Page:   c.QueryInt("page", 1),
		Limit:  c.QueryInt("limit", 20),
	}

	if params.Limit > 50 {
		params.Limit = 50
	}

	// Parse folder_id
	if folderIDStr := c.Query("folder_id"); folderIDStr != "" {
		folderID, err := uuid.Parse(folderIDStr)
		if err == nil {
			params.FolderID = &folderID
		}
	}

	// Parse status
	if statusStr := c.Query("status"); statusStr != "" {
		status := models.ProcessingStatus(statusStr)
		params.Status = &status
	}

	// Parse search
	if search := c.Query("search"); search != "" {
		params.Search = &search
	}

	files, totalCount, err := h.fileService.List(c.Context(), params)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to list files",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewPaginatedResponse(files, params.Page, params.Limit, totalCount))
}

func (h *FileHandler) GetByID(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	file, err := h.fileService.GetByID(c.Context(), userID, fileID)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to get file",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(file, ""))
}

func (h *FileHandler) Move(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	var req models.MoveFileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	err = h.fileService.Move(c.Context(), userID, fileID, req.FolderID)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		if errors.Is(err, repository.ErrFolderNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FOLDER_NOT_FOUND",
				"Target folder not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to move file",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(
		map[string]interface{}{
			"id":         fileID,
			"folder_id":  req.FolderID,
			"updated_at": time.Now(),
		},
		"File moved successfully",
	))
}

func (h *FileHandler) Rename(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	if req.Name == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "name", Message: "Name is required"},
		}))
	}

	err = h.fileService.Rename(c.Context(), userID, fileID, req.Name)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to rename file",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(
		map[string]interface{}{
			"id":         fileID,
			"name":       req.Name,
			"updated_at": time.Now(),
		},
		"File renamed successfully",
	))
}

func (h *FileHandler) Delete(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	err = h.fileService.Delete(c.Context(), userID, fileID)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to delete file",
		))
	}

	return c.SendStatus(fiber.StatusNoContent)
}

func (h *FileHandler) Presign(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req models.PresignRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	// Validation
	if req.Filename == "" || req.FileSize <= 0 || req.ContentType == "" {
		return c.Status(fiber.StatusUnprocessableEntity).JSON(models.NewValidationErrorResponse([]models.ValidationError{
			{Field: "filename", Message: "Filename is required"},
			{Field: "file_size", Message: "File size must be greater than 0"},
			{Field: "content_type", Message: "Content type is required"},
		}))
	}

	response, err := h.fileService.CreatePresignedUpload(c.Context(), userID, &req)
	if err != nil {
		errMsg := err.Error()
		if strings.Contains(errMsg, "only PDF") {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"INVALID_FILE_TYPE",
				"Only PDF files are allowed",
			))
		}
		if strings.Contains(errMsg, "exceeds maximum") {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"FILE_TOO_LARGE",
				"File size exceeds the maximum limit of 25 MB",
			))
		}
		if errors.Is(err, repository.ErrFolderNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FOLDER_NOT_FOUND",
				"Target folder not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to create upload URL",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(response, ""))
}

func (h *FileHandler) ConfirmUpload(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	var req models.ConfirmUploadRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid request body",
		))
	}

	file, err := h.fileService.ConfirmUpload(c.Context(), userID, req.UploadID)
	if err != nil {
		if errors.Is(err, repository.ErrUploadNotFound) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"UPLOAD_NOT_FOUND",
				"Upload session not found or has expired",
			))
		}
		if errors.Is(err, repository.ErrUploadExpired) {
			return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
				"UPLOAD_NOT_FOUND",
				"Upload session has expired",
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

	return c.Status(fiber.StatusCreated).JSON(models.NewAPIResponse(
		&models.FileResponse{
			ID:               file.ID,
			Filename:         file.Filename,
			OriginalFilename: file.OriginalFilename,
			FolderID:         file.FolderID,
			FileSize:         file.FileSize,
			Status:           file.Status,
			UploadedAt:       file.UploadedAt,
		},
		"File uploaded successfully. Use POST /summaries/{file_id}/generate to create a summary.",
	))
}

func (h *FileHandler) GetDownloadURL(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	expiresIn := time.Hour
	if expiresInStr := c.Query("expires_in"); expiresInStr != "" {
		if seconds, err := strconv.Atoi(expiresInStr); err == nil && seconds > 0 && seconds <= 3600 {
			expiresIn = time.Duration(seconds) * time.Second
		}
	}

	downloadURL, filename, err := h.fileService.GetDownloadURL(c.Context(), userID, fileID, expiresIn)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to generate download URL",
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(map[string]interface{}{
		"download_url": downloadURL,
		"filename":     filename,
		"expires_at":   time.Now().Add(expiresIn),
	}, ""))
}
