package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
)

var (
	ErrAlreadyProcessing = errors.New("a summary is already being generated for this file")
	ErrInvalidStyle      = errors.New("invalid summary style")
)

type SummaryService struct {
	summaryRepo *repository.SummaryRepository
	fileRepo    *repository.FileRepository
	jobRepo     *repository.ProcessingJobRepository
	aiClient    *AIClient
}

func NewSummaryService(
	summaryRepo *repository.SummaryRepository,
	fileRepo *repository.FileRepository,
	jobRepo *repository.ProcessingJobRepository,
	aiClient *AIClient,
) *SummaryService {
	return &SummaryService{
		summaryRepo: summaryRepo,
		fileRepo:    fileRepo,
		jobRepo:     jobRepo,
		aiClient:    aiClient,
	}
}

func (s *SummaryService) GetByFileID(ctx context.Context, userID, fileID uuid.UUID, version *int) (*models.SummaryResponse, *models.SummaryStatusResponse, error) {
	// Verify file ownership
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return nil, nil, err
	}

	if file.UserID != userID {
		return nil, nil, repository.ErrFileNotFound
	}

	// Check file status
	switch file.Status {
	case models.StatusProcessing:
		return nil, &models.SummaryStatusResponse{
			FileID:  fileID,
			Status:  "processing",
			Message: "Summary is being generated. Please check back shortly.",
		}, nil

	case models.StatusPending:
		return nil, &models.SummaryStatusResponse{
			FileID:  fileID,
			Status:  "pending",
			Message: "Summary generation is queued.",
		}, nil

	case models.StatusFailed:
		errMsg := ""
		if file.ErrorMessage != nil {
			errMsg = *file.ErrorMessage
		}
		return nil, &models.SummaryStatusResponse{
			FileID:       fileID,
			Status:       "failed",
			ErrorMessage: errMsg,
		}, nil

	case models.StatusUploaded:
		return nil, &models.SummaryStatusResponse{
			FileID:  fileID,
			Status:  "no_summary",
			Message: "No summary has been generated for this file yet. Click 'Summarize' to generate one.",
		}, nil
	}

	// Get summary
	var summary *models.Summary
	if version != nil {
		summary, err = s.summaryRepo.GetByFileIDAndVersion(ctx, fileID, *version)
	} else {
		summary, err = s.summaryRepo.GetCurrentByFileID(ctx, fileID)
	}

	if err != nil {
		if errors.Is(err, repository.ErrSummaryNotFound) {
			return nil, &models.SummaryStatusResponse{
				FileID:  fileID,
				Status:  "no_summary",
				Message: "No summary has been generated for this file yet. Click 'Summarize' to generate one.",
			}, nil
		}
		return nil, nil, err
	}

	return &models.SummaryResponse{
		ID:                    summary.ID,
		FileID:                summary.FileID,
		Title:                 summary.Title,
		Content:               summary.Content,
		Style:                 summary.Style,
		CustomInstructions:    summary.CustomInstructions,
		ModelUsed:             summary.ModelUsed,
		PromptTokens:          summary.PromptTokens,
		CompletionTokens:      summary.CompletionTokens,
		ProcessingStartedAt:   summary.ProcessingStartedAt,
		ProcessingCompletedAt: summary.ProcessingCompletedAt,
		ProcessingDurationMs:  summary.ProcessingDurationMs,
		Version:               summary.Version,
		IsCurrent:             summary.IsCurrent,
		CreatedAt:             summary.CreatedAt,
	}, nil, nil
}

func (s *SummaryService) GetHistory(ctx context.Context, userID, fileID uuid.UUID) ([]*models.SummaryHistoryItem, error) {
	// Verify file ownership
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if file.UserID != userID {
		return nil, repository.ErrFileNotFound
	}

	return s.summaryRepo.GetHistoryByFileID(ctx, fileID)
}

func (s *SummaryService) Generate(ctx context.Context, userID, fileID uuid.UUID, req *models.GenerateSummaryRequest) (*models.GenerateSummaryResponse, error) {
	// Validate style
	if !req.Style.IsValid() {
		return nil, ErrInvalidStyle
	}

	// Verify file ownership
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if file.UserID != userID {
		return nil, repository.ErrFileNotFound
	}

	// Check if already processing
	if file.Status == models.StatusProcessing || file.Status == models.StatusPending {
		return nil, ErrAlreadyProcessing
	}

	// Check for existing pending job
	existingJob, err := s.jobRepo.GetPendingByFileID(ctx, fileID)
	if err != nil {
		return nil, err
	}
	if existingJob != nil {
		return nil, ErrAlreadyProcessing
	}

	// Update file status to pending
	if err := s.fileRepo.UpdateStatus(ctx, fileID, models.StatusPending, nil); err != nil {
		return nil, err
	}

	// Create processing job
	job := &repository.ProcessingJob{
		FileID:  fileID,
		JobType: "summarize",
		Status:  repository.JobStatusQueued,
	}

	if err := s.jobRepo.Create(ctx, job); err != nil {
		return nil, err
	}

	// Update file status to processing
	if err := s.fileRepo.UpdateStatus(ctx, fileID, models.StatusProcessing, nil); err != nil {
		return nil, err
	}

	// Call AI service asynchronously
	go func() {
		if s.aiClient != nil {
			_ = s.aiClient.RequestSummary(context.Background(), fileID, file.StoragePath, req.Style, req.CustomInstructions)
		}
	}()

	return &models.GenerateSummaryResponse{
		FileID:             fileID,
		Status:             "processing",
		JobID:              job.ID,
		Style:              req.Style,
		CustomInstructions: req.CustomInstructions,
		Message:            "Summary generation started. Check status at GET /summaries/{file_id}",
	}, nil
}

func (s *SummaryService) GetStyles() []models.SummaryStyleInfo {
	return models.GetSummaryStyles()
}

// ProcessCallback processes the callback from AI service when summary is complete
func (s *SummaryService) ProcessCallback(ctx context.Context, fileID uuid.UUID, req *models.SummaryCallbackRequest) error {
	// Create summary
	title := req.Title
	modelUsed := req.ModelUsed
	promptTokens := req.PromptTokens
	completionTokens := req.CompletionTokens
	durationMs := req.ProcessingDurationMs

	summary := &repository.SummaryCreate{
		FileID:               fileID,
		Title:                &title,
		Content:              req.Content,
		Style:                req.Style,
		CustomInstructions:   req.CustomInstructions,
		ModelUsed:            &modelUsed,
		PromptTokens:         &promptTokens,
		CompletionTokens:     &completionTokens,
		ProcessingDurationMs: &durationMs,
	}

	if err := s.summaryRepo.Create(ctx, summary); err != nil {
		return err
	}

	// Update file status to completed
	if err := s.fileRepo.UpdateStatus(ctx, fileID, models.StatusCompleted, nil); err != nil {
		return err
	}

	return nil
}

// ProcessErrorCallback processes the callback from AI service when summary fails
func (s *SummaryService) ProcessErrorCallback(ctx context.Context, fileID uuid.UUID, errorMessage string) error {
	return s.fileRepo.UpdateStatus(ctx, fileID, models.StatusFailed, &errorMessage)
}
