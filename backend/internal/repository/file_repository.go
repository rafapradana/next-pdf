package repository

import (
	"context"
	"errors"
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nextpdf/backend/internal/models"
)

var ErrFileNotFound = errors.New("file not found")

type FileRepository struct {
	db *pgxpool.Pool
}

func NewFileRepository(db *pgxpool.Pool) *FileRepository {
	return &FileRepository{db: db}
}

func (r *FileRepository) Create(ctx context.Context, file *models.File) error {
	query := `
		INSERT INTO files (user_id, folder_id, filename, original_filename, storage_path, 
		                   mime_type, file_size, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, uploaded_at, created_at, updated_at
	`

	return r.db.QueryRow(ctx, query,
		file.UserID, file.FolderID, file.Filename, file.OriginalFilename,
		file.StoragePath, file.MimeType, file.FileSize, file.Status,
	).Scan(&file.ID, &file.UploadedAt, &file.CreatedAt, &file.UpdatedAt)
}

func (r *FileRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.File, error) {
	query := `
		SELECT id, user_id, folder_id, filename, original_filename, storage_path,
		       mime_type, file_size, page_count, status, error_message,
		       uploaded_at, processed_at, created_at, updated_at
		FROM files
		WHERE id = $1
	`

	file := &models.File{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&file.ID, &file.UserID, &file.FolderID, &file.Filename, &file.OriginalFilename,
		&file.StoragePath, &file.MimeType, &file.FileSize, &file.PageCount,
		&file.Status, &file.ErrorMessage, &file.UploadedAt, &file.ProcessedAt,
		&file.CreatedAt, &file.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFileNotFound
		}
		return nil, err
	}

	return file, nil
}

type FileListParams struct {
	UserID   uuid.UUID
	FolderID *uuid.UUID
	Status   *models.ProcessingStatus
	Search   *string
	Sort     string
	Page     int
	Limit    int
}

type FileWithSummary struct {
	models.File
	HasSummary bool
}

func (r *FileRepository) List(ctx context.Context, params FileListParams) ([]*FileWithSummary, int64, error) {
	baseQuery := `
		FROM files f
		LEFT JOIN summaries s ON s.file_id = f.id AND s.is_current = true
		WHERE f.user_id = $1
	`
	args := []interface{}{params.UserID}
	argIndex := 2

	if params.FolderID != nil {
		baseQuery += " AND f.folder_id = " + placeholder(argIndex)
		args = append(args, *params.FolderID)
		argIndex++
	}

	if params.Status != nil {
		baseQuery += " AND f.status = " + placeholder(argIndex)
		args = append(args, *params.Status)
		argIndex++
	}

	if params.Search != nil && *params.Search != "" {
		baseQuery += " AND (f.filename ILIKE " + placeholder(argIndex) + " OR f.original_filename ILIKE " + placeholder(argIndex) + ")"
		args = append(args, "%"+*params.Search+"%")
		argIndex++
	}

	// Count query
	countQuery := "SELECT COUNT(*) " + baseQuery
	var totalCount int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		return nil, 0, err
	}

	// Sort
	orderBy := " ORDER BY "
	switch params.Sort {
	case "filename":
		orderBy += "f.filename ASC"
	case "-filename":
		orderBy += "f.filename DESC"
	case "uploaded_at":
		orderBy += "f.uploaded_at ASC"
	case "file_size":
		orderBy += "f.file_size ASC"
	case "-file_size":
		orderBy += "f.file_size DESC"
	default:
		orderBy += "f.uploaded_at DESC"
	}

	// Pagination
	offset := (params.Page - 1) * params.Limit
	pagination := " LIMIT " + placeholder(argIndex) + " OFFSET " + placeholder(argIndex+1)
	args = append(args, params.Limit, offset)

	selectQuery := `
		SELECT f.id, f.user_id, f.folder_id, f.filename, f.original_filename, f.storage_path,
		       f.mime_type, f.file_size, f.page_count, f.status, f.error_message,
		       f.uploaded_at, f.processed_at, f.created_at, f.updated_at,
		       CASE WHEN s.id IS NOT NULL THEN true ELSE false END as has_summary
	` + baseQuery + orderBy + pagination

	rows, err := r.db.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var files []*FileWithSummary
	for rows.Next() {
		file := &FileWithSummary{}
		err := rows.Scan(
			&file.ID, &file.UserID, &file.FolderID, &file.Filename, &file.OriginalFilename,
			&file.StoragePath, &file.MimeType, &file.FileSize, &file.PageCount,
			&file.Status, &file.ErrorMessage, &file.UploadedAt, &file.ProcessedAt,
			&file.CreatedAt, &file.UpdatedAt, &file.HasSummary,
		)
		if err != nil {
			return nil, 0, err
		}
		files = append(files, file)
	}

	return files, totalCount, nil
}

func (r *FileRepository) GetByFolderID(ctx context.Context, folderID uuid.UUID) ([]*models.File, error) {
	query := `
		SELECT id, user_id, folder_id, filename, original_filename, storage_path,
		       mime_type, file_size, page_count, status, error_message,
		       uploaded_at, processed_at, created_at, updated_at
		FROM files
		WHERE folder_id = $1
		ORDER BY filename
	`

	rows, err := r.db.Query(ctx, query, folderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var files []*models.File
	for rows.Next() {
		file := &models.File{}
		err := rows.Scan(
			&file.ID, &file.UserID, &file.FolderID, &file.Filename, &file.OriginalFilename,
			&file.StoragePath, &file.MimeType, &file.FileSize, &file.PageCount,
			&file.Status, &file.ErrorMessage, &file.UploadedAt, &file.ProcessedAt,
			&file.CreatedAt, &file.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		files = append(files, file)
	}

	return files, nil
}

func (r *FileRepository) Move(ctx context.Context, fileID, userID uuid.UUID, folderID *uuid.UUID) error {
	query := `
		UPDATE files
		SET folder_id = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
	`

	result, err := r.db.Exec(ctx, query, fileID, folderID, userID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrFileNotFound
	}

	return nil
}

func (r *FileRepository) Rename(ctx context.Context, fileID, userID uuid.UUID, newName string) error {
	query := `
		UPDATE files
		SET original_filename = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
	`

	result, err := r.db.Exec(ctx, query, fileID, newName, userID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrFileNotFound
	}

	return nil
}

func (r *FileRepository) UpdateStatus(ctx context.Context, fileID uuid.UUID, status models.ProcessingStatus, errorMsg *string) error {
	query := `
		UPDATE files
		SET status = $2, error_message = $3, 
		    processed_at = CASE WHEN $2 IN ('completed', 'failed') THEN NOW() ELSE processed_at END,
		    updated_at = NOW()
		WHERE id = $1
	`

	result, err := r.db.Exec(ctx, query, fileID, status, errorMsg)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrFileNotFound
	}

	return nil
}

func (r *FileRepository) Delete(ctx context.Context, fileID, userID uuid.UUID) error {
	query := `DELETE FROM files WHERE id = $1 AND user_id = $2`

	result, err := r.db.Exec(ctx, query, fileID, userID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrFileNotFound
	}

	return nil
}

// placeholder returns a PostgreSQL placeholder like $1, $2, etc.
func placeholder(i int) string {
	return "$" + strconv.Itoa(i)
}
