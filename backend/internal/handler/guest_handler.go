package handler

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/nextpdf/backend/internal/models"
)

// GuestHandler handles guest (unauthenticated) operations
type GuestHandler struct {
	aiServiceURL string
	httpClient   *http.Client
}

// NewGuestHandler creates a new guest handler
func NewGuestHandler() *GuestHandler {
	aiURL := os.Getenv("AI_SERVICE_URL")
	if aiURL == "" {
		aiURL = "http://localhost:8000"
	}

	return &GuestHandler{
		aiServiceURL: aiURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // Long timeout for AI processing
		},
	}
}

// GuestSummaryResponse represents the response from AI service
type GuestSummaryResponse struct {
	Title                string `json:"title"`
	Content              string `json:"content"`
	Style                string `json:"style"`
	Language             string `json:"language"`
	ProcessingDurationMs int    `json:"processing_duration_ms"`
	ModelUsed            string `json:"model_used"`
}

// Summarize handles guest PDF summarization
// POST /api/v1/guest/summarize
func (h *GuestHandler) Summarize(c *fiber.Ctx) error {
	// Get uploaded file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"PDF file is required",
		))
	}

	// Validate file type
	if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".pdf") {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Only PDF files are allowed",
		))
	}

	// Validate file size (10MB limit for guests)
	maxSize := int64(10 * 1024 * 1024)
	if fileHeader.Size > maxSize {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"File size exceeds 10MB limit",
		))
	}

	// Get form fields
	style := c.FormValue("style", "bullet_points")
	language := c.FormValue("language", "en")
	customInstructions := c.FormValue("custom_instructions", "")

	// Validate style
	validStyles := map[string]bool{
		"bullet_points": true,
		"paragraph":     true,
		"detailed":      true,
		"executive":     true,
		"academic":      true,
	}
	if !validStyles[style] {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Invalid summary style",
		))
	}

	// Validate language
	if language != "en" && language != "id" {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse(
			"VALIDATION_ERROR",
			"Language must be 'en' or 'id'",
		))
	}

	// Open uploaded file
	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to read uploaded file",
		))
	}
	defer file.Close()

	// Read file content
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"INTERNAL_ERROR",
			"Failed to read file content",
		))
	}

	// Forward to AI service
	summary, err := h.callAIService(fileBytes, fileHeader.Filename, style, language, customInstructions)
	if err != nil {
		log.Printf("ERROR: Guest summarize failed: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse(
			"AI_SERVICE_ERROR",
			err.Error(),
		))
	}

	return c.Status(fiber.StatusOK).JSON(models.NewAPIResponse(summary, "Summary generated successfully"))
}

// SummarizeStream handles guest PDF summarization with streaming response (SSE)
// POST /api/v1/guest/summarize-stream
func (h *GuestHandler) SummarizeStream(c *fiber.Ctx) error {
	// Get uploaded file
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("VALIDATION_ERROR", "PDF file is required"))
	}

	// Validate file type
	if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".pdf") {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("VALIDATION_ERROR", "Only PDF files are allowed"))
	}

	// Validate file size (10MB limit)
	if fileHeader.Size > 10*1024*1024 {
		return c.Status(fiber.StatusBadRequest).JSON(models.NewErrorResponse("VALIDATION_ERROR", "File size exceeds 10MB limit"))
	}

	// Get form fields
	style := c.FormValue("style", "bullet_points")
	language := c.FormValue("language", "en")
	customInstructions := c.FormValue("custom_instructions", "")

	// Open uploaded file
	file, err := fileHeader.Open()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to read uploaded file"))
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to read file content"))
	}

	// Prepare request to AI Service
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add file part
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, fileHeader.Filename))
	header.Set("Content-Type", "application/pdf")
	part, err := writer.CreatePart(header)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to create request"))
	}
	part.Write(fileBytes)

	// Add fields
	writer.WriteField("style", style)
	writer.WriteField("language", language)
	if customInstructions != "" {
		writer.WriteField("custom_instructions", customInstructions)
	}
	writer.Close()

	// Create HTTP Request
	req, err := http.NewRequest("POST", h.aiServiceURL+"/summarize-stream", &buf)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(models.NewErrorResponse("INTERNAL_ERROR", "Failed to create request"))
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Execute Request (do not read body yet)
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(models.NewErrorResponse("AI_SERVICE_ERROR", "Failed to connect to AI service"))
	}

	// Set headers for SSE
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	// Stream response body
	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer resp.Body.Close()
		io.Copy(w, resp.Body)
		w.Flush()
	})

	return nil
}

// callAIService sends the PDF to the AI service for summarization
func (h *GuestHandler) callAIService(fileBytes []byte, filename, style, language, customInstructions string) (*GuestSummaryResponse, error) {
	// Create multipart form
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)

	// Add file with explicit Content-Type
	// We use CreatePart instead of CreateFormFile to set the Content-Type header
	// which is required by the AI service validation
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	header.Set("Content-Type", "application/pdf")

	part, err := writer.CreatePart(header)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file part: %w", err)
	}
	if _, err := part.Write(fileBytes); err != nil {
		return nil, fmt.Errorf("failed to write file to form: %w", err)
	}

	// Add form fields
	if err := writer.WriteField("style", style); err != nil {
		return nil, fmt.Errorf("failed to add style field: %w", err)
	}
	if err := writer.WriteField("language", language); err != nil {
		return nil, fmt.Errorf("failed to add language field: %w", err)
	}
	if customInstructions != "" {
		if err := writer.WriteField("custom_instructions", customInstructions); err != nil {
			return nil, fmt.Errorf("failed to add custom_instructions field: %w", err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	req, err := http.NewRequest("POST", h.aiServiceURL+"/summarize-sync", &buf)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Send request
	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call AI service: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read AI service response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service error: %s", string(body))
	}

	// Parse response
	var summary GuestSummaryResponse
	if err := json.Unmarshal(body, &summary); err != nil {
		return nil, fmt.Errorf("failed to parse AI service response: %w", err)
	}

	return &summary, nil
}
