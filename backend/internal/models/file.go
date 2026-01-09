package models

import (
	"time"

	"github.com/google/uuid"
)

type ProcessingStatus string

const (
	StatusUploaded   ProcessingStatus = "uploaded"
	StatusPending    ProcessingStatus = "pending"
	StatusProcessing ProcessingStatus = "processing"
	StatusCompleted  ProcessingStatus = "completed"
	StatusFailed     ProcessingStatus = "failed"
)

type File struct {
	ID               uuid.UUID        `json:"id"`
	UserID           uuid.UUID        `json:"user_id"`
	WorkspaceID      *uuid.UUID       `json:"workspace_id"`
	FolderID         *uuid.UUID       `json:"folder_id"`
	Filename         string           `json:"filename"`
	OriginalFilename string           `json:"original_filename"`
	StoragePath      string           `json:"storage_path"`
	MimeType         string           `json:"mime_type"`
	FileSize         int64            `json:"file_size"`
	PageCount        *int             `json:"page_count"`
	Status           ProcessingStatus `json:"status"`
	ErrorMessage     *string          `json:"error_message"`
	UploadedAt       time.Time        `json:"uploaded_at"`
	ProcessedAt      *time.Time       `json:"processed_at"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

type FileResponse struct {
	ID               uuid.UUID        `json:"id"`
	Filename         string           `json:"filename"`
	OriginalFilename string           `json:"original_filename"`
	FolderID         *uuid.UUID       `json:"folder_id"`
	FileSize         int64            `json:"file_size"`
	PageCount        *int             `json:"page_count,omitempty"`
	Status           ProcessingStatus `json:"status"`
	HasSummary       bool             `json:"has_summary"`
	UploadedAt       time.Time        `json:"uploaded_at"`
	ProcessedAt      *time.Time       `json:"processed_at,omitempty"`
}

type FileDetailResponse struct {
	ID               uuid.UUID        `json:"id"`
	Filename         string           `json:"filename"`
	OriginalFilename string           `json:"original_filename"`
	FolderID         *uuid.UUID       `json:"folder_id"`
	Folder           *FolderInfo      `json:"folder,omitempty"`
	StoragePath      string           `json:"storage_path"`
	MimeType         string           `json:"mime_type"`
	FileSize         int64            `json:"file_size"`
	PageCount        *int             `json:"page_count,omitempty"`
	Status           ProcessingStatus `json:"status"`
	ErrorMessage     *string          `json:"error_message,omitempty"`
	UploadedAt       time.Time        `json:"uploaded_at"`
	ProcessedAt      *time.Time       `json:"processed_at,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
	DownloadURL      string           `json:"download_url,omitempty"`
	Summary          *SummaryBrief    `json:"summary,omitempty"`
}

type FolderInfo struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

type SummaryBrief struct {
	ID                   uuid.UUID `json:"id"`
	Title                *string   `json:"title"`
	Version              int       `json:"version"`
	ProcessingDurationMs *int      `json:"processing_duration_ms,omitempty"`
	CreatedAt            time.Time `json:"created_at"`
}

type MoveFileRequest struct {
	FolderID *uuid.UUID `json:"folder_id"`
}

type PendingUpload struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"user_id"`
	WorkspaceID *uuid.UUID `json:"workspace_id"`
	FolderID    *uuid.UUID `json:"folder_id"`
	Filename    string     `json:"filename"`
	FileSize    int64      `json:"file_size"`
	ContentType string     `json:"content_type"`
	StoragePath string     `json:"storage_path"`
	ExpiresAt   time.Time  `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

type PresignRequest struct {
	Filename    string     `json:"filename" validate:"required"`
	FileSize    int64      `json:"file_size" validate:"required,gt=0"`
	ContentType string     `json:"content_type" validate:"required"`
	FolderID    *uuid.UUID `json:"folder_id"`
	WorkspaceID *uuid.UUID `json:"workspace_id"`
}

type PresignResponse struct {
	UploadID     uuid.UUID         `json:"upload_id"`
	PresignedURL string            `json:"presigned_url"`
	StoragePath  string            `json:"storage_path"`
	ExpiresAt    time.Time         `json:"expires_at"`
	Headers      map[string]string `json:"headers"`
}

type ConfirmUploadRequest struct {
	UploadID uuid.UUID `json:"upload_id" validate:"required"`
}

// Avatar upload models
type AvatarPresignRequest struct {
	Filename    string `json:"filename" validate:"required"`
	FileSize    int64  `json:"file_size" validate:"required,gt=0"`
	ContentType string `json:"content_type" validate:"required"`
}

type AvatarPresignResponse struct {
	UploadID     uuid.UUID `json:"upload_id"`
	PresignedURL string    `json:"presigned_url"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type AvatarConfirmRequest struct {
	UploadID uuid.UUID `json:"upload_id" validate:"required"`
}
