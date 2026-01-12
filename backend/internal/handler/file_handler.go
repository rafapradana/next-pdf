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
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/infrastructure"
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
	rabbitMQ         *infrastructure.RabbitMQClient
}

func NewFileHandler(fileService *service.FileService, workspaceService *service.WorkspaceService, rabbitMQ *infrastructure.RabbitMQClient) *FileHandler {
	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8000"
	}

	return &FileHandler{
		fileService:      fileService,
		workspaceService: workspaceService,
		httpClient:       &http.Client{Timeout: 30 * time.Minute},
		aiServiceURL:     aiURL,
		rabbitMQ:         rabbitMQ,
	}
}

func (h *FileHandler) SummarizeStream(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)

	fileID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("INVALID_ID", "Invalid file ID"))
	}

	startTime := time.Now()

	// 1. Get file content from storage
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

	// Strict Backend Validation
	// 1. Check Metadata
	if file.MimeType != "application/pdf" {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("INVALID_FILE_TYPE", "Only PDF files can be summarized"))
	}

	// 2. Smart Check (Magic Numbers)
	header := make([]byte, 5)
	n, err := io.ReadFull(content, header)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to validate file"))
	}

	// Check for %PDF- signature
	if !bytes.HasPrefix(header[:n], []byte("%PDF-")) {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("INVALID_FILE_TYPE", "File is not a valid PDF (missing signature)"))
	}

	// Reconstruct the reader to include the read bytes
	// We use a custom struct to combine MultiReader with the original Closer
	content = struct {
		io.Reader
		io.Closer
	}{
		Reader: io.MultiReader(bytes.NewReader(header[:n]), content),
		Closer: content,
	}

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

							// Calculate duration
							durationMs := int(time.Since(startTime).Milliseconds())
							res.ProcessingDurationMs = durationMs

							if err := h.fileService.SaveStreamSummary(saveCtx, userID, fileID, res); err != nil {
								log.Printf("ERROR: Failed to save summary for file %s: %v", fileID, err)
							} else {
								log.Printf("SUCCESS: Saved summary for file %s (Duration: %dms)", fileID, durationMs)
							}
						}(*event.Result)
					}
				}
			}
		}
	})

	return nil
}

func (h *FileHandler) SummarizeAsync(c *fiber.Ctx) error {
	userID := middleware.GetUserID(c)
	fileID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("INVALID_ID", "Invalid file ID"))
	}

	if h.rabbitMQ == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(models.NewErrorResponse("SERVICE_UNAVAILABLE", "Queue service is not available"))
	}

	// Verify file access
	file, err := h.fileService.GetByID(c.Context(), fileID, userID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(models.NewErrorResponse("NOT_FOUND", "File not found"))
	}

	// Prepare task
	task := map[string]interface{}{
		"file_id":             file.ID.String(),
		"storage_path":        file.StoragePath,
		"style":               c.FormValue("style", "bullet_points"),
		"language":            c.FormValue("language", "en"),
		"custom_instructions": c.FormValue("custom_instructions"),
	}

	// Publish to RabbitMQ
	if err := h.rabbitMQ.PublishTask(c.Context(), task); err != nil {
		log.Printf("Failed to publish task for file %s: %v", fileID, err)
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("QUEUE_ERROR", "Failed to queue task"))
	}

	return c.Status(fiber.StatusAccepted).JSON(fiber.Map{
		"status":  "queued",
		"message": "Summary generation started in background",
		"file_id": file.ID,
	})
}

func (h *FileHandler) SubscribeEvents(c *fiber.Ctx) error {
	fileID := c.Params("id")

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	msgs, err := h.rabbitMQ.SubscribeEvents("summary." + fileID)
	if err != nil {
		log.Printf("Failed to subscribe events: %v", err)
		return c.SendStatus(fiber.StatusInternalServerError)
	}

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		for msg := range msgs {
			fmt.Fprintf(w, "data: %s\n\n", msg.Body)
			w.Flush()

			// Should we peek at body to see if it is "completed" and stop?
			// Client will close connection usually.
			// But good to stop loop if channel closes.
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

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filenameBase := "files_export"

	if len(fileIDs) == 1 {
		if file, err := h.fileService.GetFile(c.Context(), fileIDs[0]); err == nil {
			// Sanitize original filename
			safeName := strings.Map(func(r rune) rune {
				if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
					return r
				}
				return '_'
			}, strings.TrimSuffix(file.OriginalFilename, filepath.Ext(file.OriginalFilename)))

			if len(safeName) > 0 {
				filenameBase = safeName
			}
		}
	}

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

		filename := fmt.Sprintf("%s_%s.json", filenameBase, timestamp)
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

	filename := fmt.Sprintf("%s_%s.csv", filenameBase, timestamp)
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
