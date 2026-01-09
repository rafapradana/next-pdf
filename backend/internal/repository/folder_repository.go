package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nextpdf/backend/internal/models"
)

var (
	ErrFolderNotFound    = errors.New("folder not found")
	ErrFolderExists      = errors.New("folder with this name already exists")
	ErrInvalidMove       = errors.New("cannot move folder into itself or its descendants")
	ErrCircularReference = errors.New("moving this folder would create a circular reference")
)

type FolderRepository struct {
	db *pgxpool.Pool
}

func NewFolderRepository(db *pgxpool.Pool) *FolderRepository {
	return &FolderRepository{db: db}
}

func (r *FolderRepository) Create(ctx context.Context, folder *models.Folder) error {
	query := `
		INSERT INTO folders (user_id, parent_id, name, path, sort_order)
		VALUES ($1, $2, $3, '', $4)
		RETURNING id, path, depth, created_at, updated_at
	`

	err := r.db.QueryRow(ctx, query,
		folder.UserID, folder.ParentID, folder.Name, folder.SortOrder,
	).Scan(&folder.ID, &folder.Path, &folder.Depth, &folder.CreatedAt, &folder.UpdatedAt)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrFolderExists
		}
		return err
	}

	return nil
}

func (r *FolderRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Folder, error) {
	query := `
		SELECT id, user_id, parent_id, name, path, depth, sort_order, created_at, updated_at
		FROM folders
		WHERE id = $1
	`

	folder := &models.Folder{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&folder.ID, &folder.UserID, &folder.ParentID, &folder.Name,
		&folder.Path, &folder.Depth, &folder.SortOrder,
		&folder.CreatedAt, &folder.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFolderNotFound
		}
		return nil, err
	}

	return folder, nil
}

func (r *FolderRepository) GetByUserID(ctx context.Context, userID uuid.UUID) ([]*models.FolderWithCounts, error) {
	query := `
		SELECT f.id, f.user_id, f.parent_id, f.name, f.path, f.depth, f.sort_order,
		       f.created_at, f.updated_at,
		       COUNT(DISTINCT files.id) AS file_count,
		       COALESCE(SUM(files.file_size), 0) AS total_size
		FROM folders f
		LEFT JOIN files ON files.folder_id = f.id
		WHERE f.user_id = $1
		GROUP BY f.id
		ORDER BY f.sort_order, f.name
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var folders []*models.FolderWithCounts
	for rows.Next() {
		folder := &models.FolderWithCounts{}
		err := rows.Scan(
			&folder.ID, &folder.UserID, &folder.ParentID, &folder.Name,
			&folder.Path, &folder.Depth, &folder.SortOrder,
			&folder.CreatedAt, &folder.UpdatedAt,
			&folder.FileCount, &folder.TotalSize,
		)
		if err != nil {
			return nil, err
		}
		folders = append(folders, folder)
	}

	return folders, nil
}

func (r *FolderRepository) Update(ctx context.Context, folder *models.Folder) error {
	query := `
		UPDATE folders
		SET name = $2, updated_at = NOW()
		WHERE id = $1 AND user_id = $3
		RETURNING updated_at
	`

	err := r.db.QueryRow(ctx, query, folder.ID, folder.Name, folder.UserID).
		Scan(&folder.UpdatedAt)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrFolderNotFound
		}
		if isDuplicateKeyError(err) {
			return ErrFolderExists
		}
		return err
	}

	return nil
}

func (r *FolderRepository) Move(ctx context.Context, folderID, userID uuid.UUID, parentID *uuid.UUID, sortOrder *int) (*models.Folder, error) {
	// Check if trying to move into itself
	if parentID != nil && *parentID == folderID {
		return nil, ErrInvalidMove
	}

	// Check for circular reference
	if parentID != nil {
		isDescendant, err := r.isDescendant(ctx, *parentID, folderID)
		if err != nil {
			return nil, err
		}
		if isDescendant {
			return nil, ErrCircularReference
		}
	}

	query := `
		UPDATE folders
		SET parent_id = $2, sort_order = COALESCE($3, sort_order), updated_at = NOW()
		WHERE id = $1 AND user_id = $4
		RETURNING id, user_id, parent_id, name, path, depth, sort_order, created_at, updated_at
	`

	folder := &models.Folder{}
	err := r.db.QueryRow(ctx, query, folderID, parentID, sortOrder, userID).Scan(
		&folder.ID, &folder.UserID, &folder.ParentID, &folder.Name,
		&folder.Path, &folder.Depth, &folder.SortOrder,
		&folder.CreatedAt, &folder.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrFolderNotFound
		}
		if isDuplicateKeyError(err) {
			return nil, ErrFolderExists
		}
		return nil, err
	}

	return folder, nil
}

func (r *FolderRepository) isDescendant(ctx context.Context, potentialDescendant, ancestor uuid.UUID) (bool, error) {
	query := `
		WITH RECURSIVE folder_tree AS (
			SELECT id, parent_id FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id, f.parent_id FROM folders f
			JOIN folder_tree ft ON f.id = ft.parent_id
		)
		SELECT EXISTS(SELECT 1 FROM folder_tree WHERE id = $2)
	`

	var isDescendant bool
	err := r.db.QueryRow(ctx, query, potentialDescendant, ancestor).Scan(&isDescendant)
	return isDescendant, err
}

func (r *FolderRepository) Delete(ctx context.Context, folderID, userID uuid.UUID) error {
	query := `DELETE FROM folders WHERE id = $1 AND user_id = $2`

	result, err := r.db.Exec(ctx, query, folderID, userID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrFolderNotFound
	}

	return nil
}

func (r *FolderRepository) GetDescendantIDs(ctx context.Context, folderID uuid.UUID) ([]uuid.UUID, error) {
	query := `
		WITH RECURSIVE folder_tree AS (
			SELECT id FROM folders WHERE id = $1
			UNION ALL
			SELECT f.id FROM folders f
			JOIN folder_tree ft ON f.parent_id = ft.id
		)
		SELECT id FROM folder_tree
	`

	rows, err := r.db.Query(ctx, query, folderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}

	return ids, nil
}

// GetByWorkspaceID returns folders for all users who are members of the given workspace.
// This allows workspace members to see each other's folders.
func (r *FolderRepository) GetByWorkspaceID(ctx context.Context, workspaceID uuid.UUID) ([]*models.FolderWithCounts, error) {
	query := `
		SELECT f.id, f.user_id, f.parent_id, f.name, f.path, f.depth, f.sort_order,
		       f.created_at, f.updated_at,
		       COUNT(DISTINCT files.id) AS file_count,
		       COALESCE(SUM(files.file_size), 0) AS total_size
		FROM folders f
		LEFT JOIN files ON files.folder_id = f.id
		WHERE f.user_id IN (
			SELECT user_id FROM workspace_members WHERE workspace_id = $1
		)
		GROUP BY f.id
		ORDER BY f.sort_order, f.name
	`

	rows, err := r.db.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var folders []*models.FolderWithCounts
	for rows.Next() {
		folder := &models.FolderWithCounts{}
		err := rows.Scan(
			&folder.ID, &folder.UserID, &folder.ParentID, &folder.Name,
			&folder.Path, &folder.Depth, &folder.SortOrder,
			&folder.CreatedAt, &folder.UpdatedAt,
			&folder.FileCount, &folder.TotalSize,
		)
		if err != nil {
			return nil, err
		}
		folders = append(folders, folder)
	}

	return folders, nil
}
