package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nextpdf/backend/internal/models"
)

var ErrSummaryNotFound = errors.New("summary not found")

type SummaryRepository struct {
	db *pgxpool.Pool
}

func NewSummaryRepository(db *pgxpool.Pool) *SummaryRepository {
	return &SummaryRepository{db: db}
}

// SummaryCreate is used for creating new summaries from AI callback
type SummaryCreate struct {
	FileID               uuid.UUID
	Title                *string
	Content              string
	Style                models.SummaryStyle
	CustomInstructions   *string
	ModelUsed            *string
	PromptTokens         *int
	CompletionTokens     *int
	ProcessingDurationMs *int
	Language             string
}

func (r *SummaryRepository) Create(ctx context.Context, summary *SummaryCreate) error {
	// Default language to English if not specified
	lang := summary.Language
	if lang == "" {
		lang = "en"
	}

	query := `
		INSERT INTO summaries (file_id, title, content, style, custom_instructions, model_used,
		                       prompt_tokens, completion_tokens, processing_duration_ms, language, is_current)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
		RETURNING id
	`

	var id uuid.UUID
	return r.db.QueryRow(ctx, query,
		summary.FileID, summary.Title, summary.Content, summary.Style,
		summary.CustomInstructions, summary.ModelUsed, summary.PromptTokens,
		summary.CompletionTokens, summary.ProcessingDurationMs, lang,
	).Scan(&id)
}

func (r *SummaryRepository) GetCurrentByFileID(ctx context.Context, fileID uuid.UUID) (*models.Summary, error) {
	query := `
		SELECT id, file_id, title, content, style, custom_instructions, model_used,
		       prompt_tokens, completion_tokens, processing_started_at, processing_completed_at,
		       processing_duration_ms, COALESCE(language, 'en') as language, version, is_current, created_at
		FROM summaries
		WHERE file_id = $1 AND is_current = true
	`

	summary := &models.Summary{}
	err := r.db.QueryRow(ctx, query, fileID).Scan(
		&summary.ID, &summary.FileID, &summary.Title, &summary.Content, &summary.Style,
		&summary.CustomInstructions, &summary.ModelUsed, &summary.PromptTokens,
		&summary.CompletionTokens, &summary.ProcessingStartedAt, &summary.ProcessingCompletedAt,
		&summary.ProcessingDurationMs, &summary.Language, &summary.Version, &summary.IsCurrent, &summary.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSummaryNotFound
		}
		return nil, err
	}

	return summary, nil
}

func (r *SummaryRepository) GetByFileIDAndVersion(ctx context.Context, fileID uuid.UUID, version int) (*models.Summary, error) {
	query := `
		SELECT id, file_id, title, content, style, custom_instructions, model_used,
		       prompt_tokens, completion_tokens, processing_started_at, processing_completed_at,
		       processing_duration_ms, COALESCE(language, 'en') as language, version, is_current, created_at
		FROM summaries
		WHERE file_id = $1 AND version = $2
	`

	summary := &models.Summary{}
	err := r.db.QueryRow(ctx, query, fileID, version).Scan(
		&summary.ID, &summary.FileID, &summary.Title, &summary.Content, &summary.Style,
		&summary.CustomInstructions, &summary.ModelUsed, &summary.PromptTokens,
		&summary.CompletionTokens, &summary.ProcessingStartedAt, &summary.ProcessingCompletedAt,
		&summary.ProcessingDurationMs, &summary.Language, &summary.Version, &summary.IsCurrent, &summary.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSummaryNotFound
		}
		return nil, err
	}

	return summary, nil
}

func (r *SummaryRepository) GetHistoryByFileID(ctx context.Context, fileID uuid.UUID) ([]*models.SummaryHistoryItem, error) {
	query := `
		SELECT id, version, title, style, custom_instructions, model_used,
		       processing_duration_ms, COALESCE(language, 'en') as language, is_current, created_at
		FROM summaries
		WHERE file_id = $1
		ORDER BY version DESC
	`

	rows, err := r.db.Query(ctx, query, fileID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*models.SummaryHistoryItem
	for rows.Next() {
		item := &models.SummaryHistoryItem{}
		err := rows.Scan(
			&item.ID, &item.Version, &item.Title, &item.Style,
			&item.CustomInstructions, &item.ModelUsed,
			&item.ProcessingDurationMs, &item.Language, &item.IsCurrent, &item.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		history = append(history, item)
	}

	return history, nil
}

func (r *SummaryRepository) GetBriefByFileID(ctx context.Context, fileID uuid.UUID) (*models.SummaryBrief, error) {
	query := `
		SELECT id, title, version, processing_duration_ms, created_at
		FROM summaries
		WHERE file_id = $1 AND is_current = true
	`

	brief := &models.SummaryBrief{}
	err := r.db.QueryRow(ctx, query, fileID).Scan(
		&brief.ID, &brief.Title, &brief.Version, &brief.ProcessingDurationMs, &brief.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return brief, nil
}
