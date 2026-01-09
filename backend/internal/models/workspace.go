package models

import (
	"time"

	"github.com/google/uuid"
)

type Workspace struct {
	ID         uuid.UUID `json:"id"`
	Name       string    `json:"name"`
	InviteCode string    `json:"invite_code"`
	OwnerID    uuid.UUID `json:"owner_id"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type WorkspaceMember struct {
	ID          uuid.UUID `json:"id"`
	WorkspaceID uuid.UUID `json:"workspace_id"`
	UserID      uuid.UUID `json:"user_id"`
	Role        string    `json:"role"` // 'owner', 'admin', 'member'
	JoinedAt    time.Time `json:"joined_at"`

	// Preloaded fields
	User      *User      `json:"user,omitempty"`
	Workspace *Workspace `json:"workspace,omitempty"`
}

type CreateWorkspaceRequest struct {
	Name string `json:"name"`
}

type JoinWorkspaceRequest struct {
	InviteCode string `json:"invite_code"`
}

type UpdateWorkspaceRequest struct {
	Name string `json:"name"`
}

type WorkspaceResponse struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	InviteCode  string    `json:"invite_code,omitempty"` // Only show if admin/owner
	Role        string    `json:"role"`
	IsOwner     bool      `json:"is_owner"`
	MemberCount int       `json:"member_count,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func (w *Workspace) ToResponse(role string) *WorkspaceResponse {
	return &WorkspaceResponse{
		ID:         w.ID,
		Name:       w.Name,
		InviteCode: w.InviteCode,
		Role:       role,
		IsOwner:    role == "owner",
		CreatedAt:  w.CreatedAt,
	}
}
