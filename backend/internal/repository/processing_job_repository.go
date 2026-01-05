package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrJobNotFound = errors.New("job not found")

type JobStatus string

const (
	JobStatusQueued     JobStatus = "queued"
	JobStatusProcessing JobStatus = "processing"
	JobStatusCompleted  JobStatus = "completed"
	JobStatusFailed     JobStatus = "failed"
	JobStatusRetrying   JobStatus = "retrying"
)

type ProcessingJob struct {
	ID           uuid.UUID  `json:"id"`
	FileID       uuid.UUID  `json:"file_id"`
	JobType      string     `json:"job_type"`
	Status       JobStatus  `json:"status"`
	Priority     int        `json:"priority"`
	Attempts     int        `json:"attempts"`
	MaxAttempts  int        `json:"max_attempts"`
	ErrorMessage *string    `json:"error_message"`
	WorkerID     *string    `json:"worker_id"`
	StartedAt    *time.Time `json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	ScheduledAt  time.Time  `json:"scheduled_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type ProcessingJobRepository struct {
	db *pgxpool.Pool
}

func NewProcessingJobRepository(db *pgxpool.Pool) *ProcessingJobRepository {
	return &ProcessingJobRepository{db: db}
}

func (r *ProcessingJobRepository) Create(ctx context.Context, job *ProcessingJob) error {
	query := `
		INSERT INTO processing_jobs (file_id, job_type, status, priority)
		VALUES ($1, $2, $3, $4)
		RETURNING id, attempts, max_attempts, scheduled_at, created_at, updated_at
	`

	return r.db.QueryRow(ctx, query,
		job.FileID, job.JobType, job.Status, job.Priority,
	).Scan(&job.ID, &job.Attempts, &job.MaxAttempts, &job.ScheduledAt, &job.CreatedAt, &job.UpdatedAt)
}

func (r *ProcessingJobRepository) GetByID(ctx context.Context, id uuid.UUID) (*ProcessingJob, error) {
	query := `
		SELECT id, file_id, job_type, status, priority, attempts, max_attempts,
		       error_message, worker_id, started_at, completed_at, scheduled_at,
		       created_at, updated_at
		FROM processing_jobs
		WHERE id = $1
	`

	job := &ProcessingJob{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&job.ID, &job.FileID, &job.JobType, &job.Status, &job.Priority,
		&job.Attempts, &job.MaxAttempts, &job.ErrorMessage, &job.WorkerID,
		&job.StartedAt, &job.CompletedAt, &job.ScheduledAt, &job.CreatedAt, &job.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrJobNotFound
		}
		return nil, err
	}

	return job, nil
}

func (r *ProcessingJobRepository) GetPendingByFileID(ctx context.Context, fileID uuid.UUID) (*ProcessingJob, error) {
	query := `
		SELECT id, file_id, job_type, status, priority, attempts, max_attempts,
		       error_message, worker_id, started_at, completed_at, scheduled_at,
		       created_at, updated_at
		FROM processing_jobs
		WHERE file_id = $1 AND status IN ('queued', 'processing', 'retrying')
		ORDER BY created_at DESC
		LIMIT 1
	`

	job := &ProcessingJob{}
	err := r.db.QueryRow(ctx, query, fileID).Scan(
		&job.ID, &job.FileID, &job.JobType, &job.Status, &job.Priority,
		&job.Attempts, &job.MaxAttempts, &job.ErrorMessage, &job.WorkerID,
		&job.StartedAt, &job.CompletedAt, &job.ScheduledAt, &job.CreatedAt, &job.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return job, nil
}

func (r *ProcessingJobRepository) UpdateStatus(ctx context.Context, jobID uuid.UUID, status JobStatus, errorMsg *string) error {
	query := `
		UPDATE processing_jobs
		SET status = $2, error_message = $3,
		    completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
		    updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, jobID, status, errorMsg)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrJobNotFound
	}

	return nil
}
