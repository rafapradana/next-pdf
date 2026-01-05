package models

import (
	"time"

	"github.com/google/uuid"
)

type SummaryStyle string

const (
	StyleBulletPoints SummaryStyle = "bullet_points"
	StyleParagraph    SummaryStyle = "paragraph"
	StyleDetailed     SummaryStyle = "detailed"
	StyleExecutive    SummaryStyle = "executive"
	StyleAcademic     SummaryStyle = "academic"
)

func (s SummaryStyle) IsValid() bool {
	switch s {
	case StyleBulletPoints, StyleParagraph, StyleDetailed, StyleExecutive, StyleAcademic:
		return true
	}
	return false
}

type Summary struct {
	ID                    uuid.UUID    `json:"id"`
	FileID                uuid.UUID    `json:"file_id"`
	Title                 *string      `json:"title"`
	Content               string       `json:"content"`
	Style                 SummaryStyle `json:"style"`
	CustomInstructions    *string      `json:"custom_instructions"`
	ModelUsed             *string      `json:"model_used"`
	PromptTokens          *int         `json:"prompt_tokens"`
	CompletionTokens      *int         `json:"completion_tokens"`
	ProcessingStartedAt   *time.Time   `json:"processing_started_at"`
	ProcessingCompletedAt *time.Time   `json:"processing_completed_at"`
	ProcessingDurationMs  *int         `json:"processing_duration_ms"`
	Language              string       `json:"language"`
	Version               int          `json:"version"`
	IsCurrent             bool         `json:"is_current"`
	CreatedAt             time.Time    `json:"created_at"`
}

type SummaryResponse struct {
	ID                    uuid.UUID    `json:"id"`
	FileID                uuid.UUID    `json:"file_id"`
	Title                 *string      `json:"title,omitempty"`
	Content               string       `json:"content"`
	Style                 SummaryStyle `json:"style"`
	CustomInstructions    *string      `json:"custom_instructions,omitempty"`
	ModelUsed             *string      `json:"model_used,omitempty"`
	PromptTokens          *int         `json:"prompt_tokens,omitempty"`
	CompletionTokens      *int         `json:"completion_tokens,omitempty"`
	ProcessingStartedAt   *time.Time   `json:"processing_started_at,omitempty"`
	ProcessingCompletedAt *time.Time   `json:"processing_completed_at,omitempty"`
	ProcessingDurationMs  *int         `json:"processing_duration_ms,omitempty"`
	Language              string       `json:"language"`
	Version               int          `json:"version"`
	IsCurrent             bool         `json:"is_current"`
	CreatedAt             time.Time    `json:"created_at"`
}

type SummaryHistoryItem struct {
	ID                   uuid.UUID    `json:"id"`
	Version              int          `json:"version"`
	Title                *string      `json:"title,omitempty"`
	Style                SummaryStyle `json:"style"`
	CustomInstructions   *string      `json:"custom_instructions,omitempty"`
	ModelUsed            *string      `json:"model_used,omitempty"`
	ProcessingDurationMs *int         `json:"processing_duration_ms,omitempty"`
	Language             string       `json:"language"`
	IsCurrent            bool         `json:"is_current"`
	CreatedAt            time.Time    `json:"created_at"`
}

type GenerateSummaryRequest struct {
	Style              SummaryStyle `json:"style" validate:"required"`
	CustomInstructions *string      `json:"custom_instructions" validate:"omitempty,max=500"`
	Language           string       `json:"language" validate:"omitempty,oneof=en id"`
}

type SummaryStatusResponse struct {
	FileID       uuid.UUID `json:"file_id"`
	Status       string    `json:"status"`
	Message      string    `json:"message,omitempty"`
	ErrorMessage string    `json:"error_message,omitempty"`
}

type GenerateSummaryResponse struct {
	FileID             uuid.UUID    `json:"file_id"`
	Status             string       `json:"status"`
	JobID              uuid.UUID    `json:"job_id"`
	Style              SummaryStyle `json:"style"`
	CustomInstructions *string      `json:"custom_instructions,omitempty"`
	Message            string       `json:"message"`
}

type SummaryStyleInfo struct {
	ID            SummaryStyle `json:"id"`
	Name          string       `json:"name"`
	Description   string       `json:"description"`
	ExampleOutput string       `json:"example_output"`
}

func GetSummaryStyles() []SummaryStyleInfo {
	return []SummaryStyleInfo{
		{
			ID:            StyleBulletPoints,
			Name:          "Bullet Points",
			Description:   "Concise bullet-point format highlighting key information",
			ExampleOutput: "• Key finding 1\n• Key finding 2\n• Key finding 3",
		},
		{
			ID:            StyleParagraph,
			Name:          "Paragraph",
			Description:   "Flowing paragraph narrative for easy reading",
			ExampleOutput: "This document discusses... The main points include...",
		},
		{
			ID:            StyleDetailed,
			Name:          "Detailed Analysis",
			Description:   "Comprehensive detailed analysis with sections",
			ExampleOutput: "## Overview\n...\n## Key Findings\n...\n## Methodology\n...",
		},
		{
			ID:            StyleExecutive,
			Name:          "Executive Summary",
			Description:   "Brief executive summary with key takeaways for quick decisions",
			ExampleOutput: "**Bottom Line:** ...\n**Key Takeaways:**\n1. ...\n2. ...",
		},
		{
			ID:            StyleAcademic,
			Name:          "Academic Style",
			Description:   "Academic/research style with structured sections",
			ExampleOutput: "**Abstract:** ...\n**Methods:** ...\n**Results:** ...\n**Conclusion:** ...",
		},
	}
}

// SummaryCallbackRequest is the request from AI service callback
type SummaryCallbackRequest struct {
	FileID               string       `json:"file_id"`
	Title                string       `json:"title"`
	Content              string       `json:"content"`
	Style                SummaryStyle `json:"style"`
	CustomInstructions   *string      `json:"custom_instructions"`
	ModelUsed            string       `json:"model_used"`
	PromptTokens         int          `json:"prompt_tokens"`
	CompletionTokens     int          `json:"completion_tokens"`
	ProcessingDurationMs int          `json:"processing_duration_ms"`
	Language             string       `json:"language"`
	Status               string       `json:"status"`
	ErrorMessage         string       `json:"error_message,omitempty"`
}

// AIServiceRequest is the request to send to AI service
type AIServiceRequest struct {
	FileID             string  `json:"file_id"`
	StoragePath        string  `json:"storage_path"`
	Style              string  `json:"style"`
	CustomInstructions *string `json:"custom_instructions,omitempty"`
	Language           string  `json:"language"`
	CallbackURL        string  `json:"callback_url,omitempty"`
}
