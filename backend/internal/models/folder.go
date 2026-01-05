package models

import (
	"time"

	"github.com/google/uuid"
)

type Folder struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	ParentID  *uuid.UUID `json:"parent_id"`
	Name      string     `json:"name"`
	Path      string     `json:"path"`
	Depth     int        `json:"depth"`
	SortOrder int        `json:"sort_order"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type FolderWithCounts struct {
	Folder
	FileCount int64 `json:"file_count"`
	TotalSize int64 `json:"total_size"`
}

type FolderTreeNode struct {
	ID        uuid.UUID         `json:"id"`
	Name      string            `json:"name"`
	ParentID  *uuid.UUID        `json:"parent_id"`
	Depth     int               `json:"depth"`
	SortOrder int               `json:"sort_order"`
	FileCount int64             `json:"file_count,omitempty"`
	TotalSize int64             `json:"total_size,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
	Children  []*FolderTreeNode `json:"children"`
	Files     []*FileResponse   `json:"files,omitempty"`
}

type CreateFolderRequest struct {
	Name     string     `json:"name" validate:"required,min=1,max=255"`
	ParentID *uuid.UUID `json:"parent_id"`
}

type UpdateFolderRequest struct {
	Name string `json:"name" validate:"required,min=1,max=255"`
}

type MoveFolderRequest struct {
	ParentID  *uuid.UUID `json:"parent_id"`
	SortOrder *int       `json:"sort_order"`
}
