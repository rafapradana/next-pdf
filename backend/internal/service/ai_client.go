package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
)

type AIClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewAIClient() *AIClient {
	baseURL := os.Getenv("AI_SERVICE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8000"
	}

	return &AIClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// RequestSummary sends a request to the AI service to generate a summary
func (c *AIClient) RequestSummary(ctx context.Context, fileID uuid.UUID, storagePath string, style models.SummaryStyle, customInstructions *string, language string) error {
	// Default to English if not specified
	if language == "" {
		language = "en"
	}

	request := models.AIServiceRequest{
		FileID:             fileID.String(),
		StoragePath:        storagePath,
		Style:              string(style),
		CustomInstructions: customInstructions,
		Language:           language,
	}

	jsonData, err := json.Marshal(request)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL+"/summarize", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request to AI service: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return fmt.Errorf("AI service returned status %d", resp.StatusCode)
	}

	return nil
}

// HealthCheck checks if the AI service is healthy
func (c *AIClient) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/health", nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("AI service unhealthy: status %d", resp.StatusCode)
	}

	return nil
}
