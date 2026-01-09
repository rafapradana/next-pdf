package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nextpdf/backend/internal/models"
)

var (
	ErrUploadNotFound = errors.New("upload not found")
	ErrUploadExpired  = errors.New("upload has expired")
)

type PendingUploadRepository struct {
	db *pgxpool.Pool
}

func NewPendingUploadRepository(db *pgxpool.Pool) *PendingUploadRepository {
	return &PendingUploadRepository{db: db}
}

func (r *PendingUploadRepository) Create(ctx context.Context, upload *models.PendingUpload) error {
	query := `
		INSERT INTO pending_uploads (user_id, workspace_id, folder_id, filename, file_size, content_type, storage_path, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`

	return r.db.QueryRow(ctx, query,
		upload.UserID, upload.WorkspaceID, upload.FolderID, upload.Filename, upload.FileSize,
		upload.ContentType, upload.StoragePath, upload.ExpiresAt,
	).Scan(&upload.ID, &upload.CreatedAt)
}

func (r *PendingUploadRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.PendingUpload, error) {
	query := `
		SELECT id, user_id, workspace_id, folder_id, filename, file_size, content_type, storage_path, expires_at, created_at
		FROM pending_uploads
		WHERE id = $1
	`

	upload := &models.PendingUpload{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&upload.ID, &upload.UserID, &upload.WorkspaceID, &upload.FolderID, &upload.Filename,
		&upload.FileSize, &upload.ContentType, &upload.StoragePath,
		&upload.ExpiresAt, &upload.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUploadNotFound
		}
		return nil, err
	}

	if upload.ExpiresAt.Before(time.Now()) {
		return nil, ErrUploadExpired
	}

	return upload, nil
}

func (r *PendingUploadRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM pending_uploads WHERE id = $1`
	_, err := r.db.Exec(ctx, query, id)
	return err
}

func (r *PendingUploadRepository) CleanupExpired(ctx context.Context) (int64, error) {
	query := `DELETE FROM pending_uploads WHERE expires_at < NOW()`
	result, err := r.db.Exec(ctx, query)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected(), nil
}
