package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
)

var (
	ErrWorkspaceNotFound = repository.ErrWorkspaceNotFound
	ErrInviteCodeInvalid = repository.ErrInviteCodeInvalid
	ErrAlreadyMember     = repository.ErrAlreadyMember
)

type WorkspaceService struct {
	repo *repository.WorkspaceRepository
}

func NewWorkspaceService(repo *repository.WorkspaceRepository) *WorkspaceService {
	return &WorkspaceService{repo: repo}
}

func (s *WorkspaceService) CreateWorkspace(ctx context.Context, userID uuid.UUID, name string) (*models.Workspace, error) {
	// Generate random invite code
	inviteCode, err := generateInviteCode()
	if err != nil {
		return nil, err
	}

	workspace := &models.Workspace{
		Name:       name,
		InviteCode: inviteCode,
		OwnerID:    userID,
	}

	if err := s.repo.Create(ctx, workspace); err != nil {
		return nil, err
	}

	// Add owner as member
	member := &models.WorkspaceMember{
		WorkspaceID: workspace.ID,
		UserID:      userID,
		Role:        "owner",
	}

	if err := s.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	return workspace, nil
}

func (s *WorkspaceService) JoinWorkspace(ctx context.Context, userID uuid.UUID, inviteCode string) (*models.Workspace, error) {
	// Find workspace by code
	workspace, err := s.repo.GetByInviteCode(ctx, strings.ToUpper(strings.TrimSpace(inviteCode)))
	if err != nil {
		return nil, err
	}

	// Add member
	member := &models.WorkspaceMember{
		WorkspaceID: workspace.ID,
		UserID:      userID,
		Role:        "member",
	}

	if err := s.repo.AddMember(ctx, member); err != nil {
		return nil, err
	}

	return workspace, nil
}

func (s *WorkspaceService) UpdateWorkspace(ctx context.Context, userID, workspaceID uuid.UUID, name string) (*models.Workspace, error) {
	workspace, err := s.repo.GetByID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	if workspace.OwnerID != userID {
		return nil, errors.New("FORBIDDEN: Only the owner can update the workspace")
	}

	workspace.Name = name
	if err := s.repo.UpdateRow(ctx, workspace); err != nil {
		return nil, err
	}

	return workspace, nil
}

func (s *WorkspaceService) GetUserWorkspaces(ctx context.Context, userID uuid.UUID) ([]*models.WorkspaceResponse, error) {
	return s.repo.ListByUserID(ctx, userID)
}

func (s *WorkspaceService) GetWorkspace(ctx context.Context, workspaceID uuid.UUID) (*models.Workspace, error) {
	return s.repo.GetByID(ctx, workspaceID)
}

func (s *WorkspaceService) VerifyMemberAccess(ctx context.Context, workspaceID, userID uuid.UUID) (*models.WorkspaceMember, error) {
	return s.repo.GetMember(ctx, workspaceID, userID)
}

func generateInviteCode() (string, error) {
	bytes := make([]byte, 4) // 4 bytes = 8 hex chars
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return strings.ToUpper(hex.EncodeToString(bytes)), nil
}
