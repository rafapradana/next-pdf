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
	ErrWorkspaceNotFound = errors.New("workspace not found")
	ErrInviteCodeInvalid = errors.New("invite code invalid")
	ErrAlreadyMember     = errors.New("user is already a member of this workspace")
)

type WorkspaceRepository struct {
	db *pgxpool.Pool
}

func NewWorkspaceRepository(db *pgxpool.Pool) *WorkspaceRepository {
	return &WorkspaceRepository{db: db}
}

func (r *WorkspaceRepository) Create(ctx context.Context, workspace *models.Workspace) error {
	query := `
		INSERT INTO workspaces (name, invite_code, owner_id)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(ctx, query, workspace.Name, workspace.InviteCode, workspace.OwnerID).
		Scan(&workspace.ID, &workspace.CreatedAt, &workspace.UpdatedAt)

	if err != nil {
		return err
	}

	return nil
}

func (r *WorkspaceRepository) UpdateRow(ctx context.Context, workspace *models.Workspace) error {
	query := `
		UPDATE workspaces
		SET name = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING updated_at
	`

	err := r.db.QueryRow(ctx, query, workspace.ID, workspace.Name).Scan(&workspace.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrWorkspaceNotFound
		}
		return err
	}

	return nil
}

func (r *WorkspaceRepository) GetByID(ctx context.Context, id uuid.UUID) (*models.Workspace, error) {
	query := `
		SELECT id, name, invite_code, owner_id, created_at, updated_at
		FROM workspaces
		WHERE id = $1
	`

	ws := &models.Workspace{}
	err := r.db.QueryRow(ctx, query, id).Scan(
		&ws.ID, &ws.Name, &ws.InviteCode, &ws.OwnerID, &ws.CreatedAt, &ws.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}

	return ws, nil
}

func (r *WorkspaceRepository) GetByInviteCode(ctx context.Context, code string) (*models.Workspace, error) {
	query := `
		SELECT id, name, invite_code, owner_id, created_at, updated_at
		FROM workspaces
		WHERE invite_code = $1
	`

	ws := &models.Workspace{}
	err := r.db.QueryRow(ctx, query, code).Scan(
		&ws.ID, &ws.Name, &ws.InviteCode, &ws.OwnerID, &ws.CreatedAt, &ws.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInviteCodeInvalid
		}
		return nil, err
	}

	return ws, nil
}

func (r *WorkspaceRepository) AddMember(ctx context.Context, member *models.WorkspaceMember) error {
	query := `
		INSERT INTO workspace_members (workspace_id, user_id, role)
		VALUES ($1, $2, $3)
		RETURNING id, joined_at
	`

	err := r.db.QueryRow(ctx, query, member.WorkspaceID, member.UserID, member.Role).
		Scan(&member.ID, &member.JoinedAt)

	if err != nil {
		if isDuplicateKeyError(err) {
			return ErrAlreadyMember
		}
		return err
	}

	return nil
}

func (r *WorkspaceRepository) GetMember(ctx context.Context, workspaceID, userID uuid.UUID) (*models.WorkspaceMember, error) {
	query := `
		SELECT id, workspace_id, user_id, role, joined_at
		FROM workspace_members
		WHERE workspace_id = $1 AND user_id = $2
	`

	m := &models.WorkspaceMember{}
	err := r.db.QueryRow(ctx, query, workspaceID, userID).Scan(
		&m.ID, &m.WorkspaceID, &m.UserID, &m.Role, &m.JoinedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows // Let service handle "not a member"
		}
		return nil, err
	}

	return m, nil
}

func (r *WorkspaceRepository) ListByUserID(ctx context.Context, userID uuid.UUID) ([]*models.WorkspaceResponse, error) {
	query := `
		SELECT w.id, w.name, w.invite_code, wm.role, w.owner_id, w.created_at
		FROM workspaces w
		JOIN workspace_members wm ON w.id = wm.workspace_id
		WHERE wm.user_id = $1
		ORDER BY w.created_at ASC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var workspaces []*models.WorkspaceResponse
	for rows.Next() {
		var w models.WorkspaceResponse
		var ownerID uuid.UUID
		err := rows.Scan(&w.ID, &w.Name, &w.InviteCode, &w.Role, &ownerID, &w.CreatedAt)
		if err != nil {
			return nil, err
		}
		w.IsOwner = (ownerID == userID)
		workspaces = append(workspaces, &w)
	}

	return workspaces, nil
}

func (r *WorkspaceRepository) GetMemberCount(ctx context.Context, workspaceID uuid.UUID) (int, error) {
	query := `SELECT COUNT(*) FROM workspace_members WHERE workspace_id = $1`
	var count int
	err := r.db.QueryRow(ctx, query, workspaceID).Scan(&count)
	return count, err
}
