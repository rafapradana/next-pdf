package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/storage"
)

type FolderService struct {
	folderRepo *repository.FolderRepository
	fileRepo   *repository.FileRepository
	storage    *storage.Storage
}

func NewFolderService(
	folderRepo *repository.FolderRepository,
	fileRepo *repository.FileRepository,
	storage *storage.Storage,
) *FolderService {
	return &FolderService{
		folderRepo: folderRepo,
		fileRepo:   fileRepo,
		storage:    storage,
	}
}

func (s *FolderService) Create(ctx context.Context, userID uuid.UUID, req *models.CreateFolderRequest) (*models.Folder, error) {
	// Validate parent folder if provided
	if req.ParentID != nil {
		parent, err := s.folderRepo.GetByID(ctx, *req.ParentID)
		if err != nil {
			return nil, err
		}
		if parent.UserID != userID {
			return nil, repository.ErrFolderNotFound
		}
	}

	folder := &models.Folder{
		UserID:   userID,
		ParentID: req.ParentID,
		Name:     req.Name,
	}

	if err := s.folderRepo.Create(ctx, folder); err != nil {
		return nil, err
	}

	return folder, nil
}

func (s *FolderService) GetTree(ctx context.Context, userID uuid.UUID, includeFiles, includeCounts bool) ([]*models.FolderTreeNode, error) {
	folders, err := s.folderRepo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Build tree structure
	nodeMap := make(map[uuid.UUID]*models.FolderTreeNode)
	var rootNodes []*models.FolderTreeNode

	// Create nodes
	for _, f := range folders {
		node := &models.FolderTreeNode{
			ID:        f.ID,
			Name:      f.Name,
			ParentID:  f.ParentID,
			Depth:     f.Depth,
			SortOrder: f.SortOrder,
			CreatedAt: f.CreatedAt,
			Children:  []*models.FolderTreeNode{},
		}

		if includeCounts {
			node.FileCount = f.FileCount
			node.TotalSize = f.TotalSize
		}

		nodeMap[f.ID] = node
	}

	// Build hierarchy
	for _, f := range folders {
		node := nodeMap[f.ID]
		if f.ParentID == nil {
			rootNodes = append(rootNodes, node)
		} else {
			if parent, ok := nodeMap[*f.ParentID]; ok {
				parent.Children = append(parent.Children, node)
			}
		}
	}

	// Include files if requested
	if includeFiles {
		for _, node := range nodeMap {
			files, err := s.fileRepo.GetByFolderID(ctx, node.ID)
			if err != nil {
				return nil, err
			}
			for _, f := range files {
				node.Files = append(node.Files, &models.FileResponse{
					ID:               f.ID,
					Filename:         f.Filename,
					OriginalFilename: f.OriginalFilename,
					FolderID:         f.FolderID,
					FileSize:         f.FileSize,
					PageCount:        f.PageCount,
					Status:           f.Status,
					UploadedAt:       f.UploadedAt,
					ProcessedAt:      f.ProcessedAt,
				})
			}
		}
	}

	return rootNodes, nil
}

func (s *FolderService) Update(ctx context.Context, userID, folderID uuid.UUID, req *models.UpdateFolderRequest) (*models.Folder, error) {
	folder, err := s.folderRepo.GetByID(ctx, folderID)
	if err != nil {
		return nil, err
	}

	if folder.UserID != userID {
		return nil, repository.ErrFolderNotFound
	}

	folder.Name = req.Name

	if err := s.folderRepo.Update(ctx, folder); err != nil {
		return nil, err
	}

	return folder, nil
}

func (s *FolderService) Move(ctx context.Context, userID, folderID uuid.UUID, req *models.MoveFolderRequest) (*models.Folder, error) {
	// Validate parent folder if provided
	if req.ParentID != nil {
		parent, err := s.folderRepo.GetByID(ctx, *req.ParentID)
		if err != nil {
			return nil, err
		}
		if parent.UserID != userID {
			return nil, repository.ErrFolderNotFound
		}
	}

	return s.folderRepo.Move(ctx, folderID, userID, req.ParentID, req.SortOrder)
}

func (s *FolderService) Delete(ctx context.Context, userID, folderID uuid.UUID) error {
	folder, err := s.folderRepo.GetByID(ctx, folderID)
	if err != nil {
		return err
	}

	if folder.UserID != userID {
		return repository.ErrFolderNotFound
	}

	// Get all descendant folder IDs for file cleanup
	descendantIDs, err := s.folderRepo.GetDescendantIDs(ctx, folderID)
	if err != nil {
		return err
	}

	// Delete files from storage for all folders
	for _, fID := range descendantIDs {
		files, err := s.fileRepo.GetByFolderID(ctx, fID)
		if err != nil {
			return err
		}
		for _, f := range files {
			_ = s.storage.DeleteObject(ctx, s.storage.BucketFiles(), f.StoragePath)
		}
	}

	// Delete folder (cascades to files and subfolders)
	return s.folderRepo.Delete(ctx, folderID, userID)
}
