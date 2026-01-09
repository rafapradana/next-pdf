package handler

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
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
	fileService      *service.FileService
	workspaceService *service.WorkspaceService
	httpClient       *http.Client
	aiServiceURL     string
}

func NewFileHandler(fileService *service.FileService, workspaceService *service.WorkspaceService) *FileHandler {
	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8000"
	}

	return &FileHandler{
		fileService:      fileService,
		workspaceService: workspaceService,
		httpClient:       &http.Client{Timeout: 0},
		aiServiceURL:     aiURL,
	}
}

func (h *FileHandler) SummarizeStream(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileIDStr := c.Params("id")
	fileID, err := uuid.Parse(fileIDStr)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid file ID",
		))
	}

	// 1. Get file content and metadata
	content, file, err := h.fileService.GetFileContent(c.Context(), userID, fileID)
	if err != nil {
		if errors.Is(err, repository.ErrFileNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse(
				"FILE_NOT_FOUND",
				"File not found",
			))
		}
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to retrieve file content",
		))
	}
	defer content.Close()

	// 2. Prepare request to AI Service
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add fields
	_ = writer.WriteField("style", c.FormValue("style", "bullet_points"))
	_ = writer.WriteField("language", c.FormValue("language", "en"))
	if customInstructions := c.FormValue("custom_instructions"); customInstructions != "" {
		_ = writer.WriteField("custom_instructions", customInstructions)
	}

	// Add file part with explicit Content-Type
	partHeader := make(textproto.MIMEHeader)
	partHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, file.OriginalFilename))
	partHeader.Set("Content-Type", "application/pdf")

	part, err := writer.CreatePart(partHeader)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to create multipart request"))
	}

	if _, err := io.Copy(part, content); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to write file content"))
	}

	writer.Close()

	// 3. Send request to AI Service
	req, err := http.NewRequest("POST", h.aiServiceURL+"/summarize-stream", &buf)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to create request"))
	}

	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(models.NewErrorResponse("AI_SERVICE_ERROR", "Failed to connect to AI service"))
	}

	// 4. Stream response back to client
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer resp.Body.Close()

		reader := bufio.NewReader(resp.Body)

		for {
			line, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					// Log error if needed, but don't break flow if possible
				}
				break
			}

			// Write to client
			fmt.Fprint(w, line)
			w.Flush()

			// Check for result to save to DB
			if strings.HasPrefix(line, "data: ") {
				payload := strings.TrimSpace(strings.TrimPrefix(line, "data: "))
				if strings.Contains(payload, "\"result\"") {
					var event struct {
						Result *models.SummaryCallbackRequest `json:"result"`
					}
					// Only try to parse if it looks like a result to avoid overhead
					if err := json.Unmarshal([]byte(payload), &event); err == nil && event.Result != nil {
						// Save to DB asynchronously
						go func(res models.SummaryCallbackRequest) {
							saveCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
							defer cancel()
							_ = h.fileService.SaveStreamSummary(saveCtx, userID, fileID, res)
						}(*event.Result)
					}
				}
			}
		}
	})

	return nil
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

	// Parse workspace_id
	if workspaceIDStr := c.Query("workspace_id"); workspaceIDStr != "" {
		workspaceID, err := uuid.Parse(workspaceIDStr)
		if err == nil {
			// Verify access
			_, err := h.workspaceService.VerifyMemberAccess(c.Context(), workspaceID, userID)
			if err != nil {
				return c.Status(fiber.StatusForbidden).JSON(models.NewErrorResponse(
					"FORBIDDEN",
					"You do not have access to this workspace",
				))
			}
			params.WorkspaceID = &workspaceID
		}
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

func (h *FileHandler) Export(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	params := repository.FileListParams{
		UserID: userID,
	}

	// Parse format (default to csv)
	format := c.Query("format", "csv")
	if format != "json" && format != "csv" {
		format = "csv"
	}

	// Parse filtering params just like List
	if folderIDStr := c.Query("folder_id"); folderIDStr != "" {
		if folderID, err := uuid.Parse(folderIDStr); err == nil {
			params.FolderID = &folderID
		}
	}
	if statusStr := c.Query("status"); statusStr != "" {
		status := models.ProcessingStatus(statusStr)
		params.Status = &status
	}
	if search := c.Query("search"); search != "" {
		params.Search = &search
	}

	// Parse file_ids (optional)
	var fileIDs []uuid.UUID
	if fileIDsStr := c.Query("file_ids"); fileIDsStr != "" {
		for _, idStr := range strings.Split(fileIDsStr, ",") {
			if id, err := uuid.Parse(strings.TrimSpace(idStr)); err == nil {
				fileIDs = append(fileIDs, id)
			}
		}
	}

	// Parse workspace_id
	var workspaceID uuid.UUID
	if workspaceIDStr := c.Query("workspace_id"); workspaceIDStr != "" {
		if id, err := uuid.Parse(workspaceIDStr); err == nil {
			// Verify access
			_, err := h.workspaceService.VerifyMemberAccess(c.Context(), id, userID)
			if err != nil {
				return c.Status(fiber.StatusForbidden).JSON(models.NewErrorResponse(
					"FORBIDDEN",
					"You do not have access to this workspace",
				))
			}
			workspaceID = id
		}
	}

	timestamp := time.Now().Format("20060102_150405")

	if format == "json" {
		// Export as JSON
		jsonData, err := h.fileService.ExportToJSON(c.Context(), userID, workspaceID, params, fileIDs)
		if err != nil {
			log.Printf("Export error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
				"INTERNAL_ERROR",
				"Failed to export files: "+err.Error(),
			))
		}

		filename := fmt.Sprintf("files_export_%s.json", timestamp)
		c.Set("Content-Type", "application/json")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		return c.JSON(jsonData)
	}

	// Export as CSV (default)
	csvReader, err := h.fileService.ExportToCSV(c.Context(), userID, workspaceID, params, fileIDs)
	if err != nil {
		log.Printf("Export error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to export files: "+err.Error(),
		))
	}

	filename := fmt.Sprintf("files_export_%s.csv", timestamp)
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	return c.SendStream(csvReader)
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
