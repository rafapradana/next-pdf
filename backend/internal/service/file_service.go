package service

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/config"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/storage"
)

type FileService struct {
	fileRepo          *repository.FileRepository
	folderRepo        *repository.FolderRepository
	pendingUploadRepo *repository.PendingUploadRepository
	summaryRepo       *repository.SummaryRepository
	storage           *storage.Storage
	uploadConfig      config.UploadConfig
}

func NewFileService(
	fileRepo *repository.FileRepository,
	folderRepo *repository.FolderRepository,
	pendingUploadRepo *repository.PendingUploadRepository,
	summaryRepo *repository.SummaryRepository,
	storage *storage.Storage,
	uploadConfig config.UploadConfig,
) *FileService {
	return &FileService{
		fileRepo:          fileRepo,
		folderRepo:        folderRepo,
		pendingUploadRepo: pendingUploadRepo,
		summaryRepo:       summaryRepo,
		storage:           storage,
		uploadConfig:      uploadConfig,
	}
}

func (s *FileService) CreatePresignedUpload(ctx context.Context, userID uuid.UUID, req *models.PresignRequest) (*models.PresignResponse, error) {
	// Validate file type
	if req.ContentType != "application/pdf" {
		return nil, fmt.Errorf("only PDF files are allowed")
	}

	// Validate file size
	maxSize := s.uploadConfig.MaxFileSizeMB * 1024 * 1024
	if req.FileSize > maxSize {
		return nil, fmt.Errorf("file size exceeds maximum limit of %d MB", s.uploadConfig.MaxFileSizeMB)
	}

	// Validate folder if provided
	if req.FolderID != nil {
		folder, err := s.folderRepo.GetByID(ctx, *req.FolderID)
		if err != nil {
			return nil, repository.ErrFolderNotFound
		}
		if folder.UserID != userID {
			return nil, repository.ErrFolderNotFound
		}
	}

	// Generate storage path
	fileID := uuid.New()
	ext := filepath.Ext(req.Filename)
	if ext == "" {
		ext = ".pdf"
	}
	storagePath := fmt.Sprintf("users/%s/files/%s%s", userID.String(), fileID.String(), ext)

	// Generate presigned URL
	presignedURL, err := s.storage.GeneratePresignedPutURL(ctx, s.storage.BucketUploads(), storagePath, req.ContentType, req.FileSize)
	if err != nil {
		return nil, err
	}

	// Create pending upload record
	expiresAt := time.Now().Add(s.storage.PresignExpiry())
	pendingUpload := &models.PendingUpload{
		UserID:      userID,
		FolderID:    req.FolderID,
		Filename:    req.Filename,
		FileSize:    req.FileSize,
		ContentType: req.ContentType,
		StoragePath: storagePath,
		ExpiresAt:   expiresAt,
	}

	if err := s.pendingUploadRepo.Create(ctx, pendingUpload); err != nil {
		return nil, err
	}

	return &models.PresignResponse{
		UploadID:     pendingUpload.ID,
		PresignedURL: presignedURL.String(),
		StoragePath:  storagePath,
		ExpiresAt:    expiresAt,
		Headers: map[string]string{
			"Content-Type":   req.ContentType,
			"Content-Length": fmt.Sprintf("%d", req.FileSize),
		},
	}, nil
}

func (s *FileService) ConfirmUpload(ctx context.Context, userID uuid.UUID, uploadID uuid.UUID) (*models.File, error) {
	// Get pending upload
	pendingUpload, err := s.pendingUploadRepo.GetByID(ctx, uploadID)
	if err != nil {
		return nil, err
	}

	if pendingUpload.UserID != userID {
		return nil, repository.ErrUploadNotFound
	}

	// Verify file exists in storage
	exists, err := s.storage.ObjectExists(ctx, s.storage.BucketUploads(), pendingUpload.StoragePath)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("file not found in storage")
	}

	// Move file from uploads bucket to files bucket
	if err := s.storage.CopyObject(ctx,
		s.storage.BucketUploads(), pendingUpload.StoragePath,
		s.storage.BucketFiles(), pendingUpload.StoragePath,
	); err != nil {
		return nil, err
	}

	// Delete from uploads bucket
	_ = s.storage.DeleteObject(ctx, s.storage.BucketUploads(), pendingUpload.StoragePath)

	// Generate safe filename
	safeFilename := generateSafeFilename(pendingUpload.Filename)

	// Create file record
	file := &models.File{
		UserID:           userID,
		FolderID:         pendingUpload.FolderID,
		Filename:         safeFilename,
		OriginalFilename: pendingUpload.Filename,
		StoragePath:      pendingUpload.StoragePath,
		MimeType:         pendingUpload.ContentType,
		FileSize:         pendingUpload.FileSize,
		Status:           models.StatusUploaded,
	}

	if err := s.fileRepo.Create(ctx, file); err != nil {
		return nil, err
	}

	// Delete pending upload
	_ = s.pendingUploadRepo.Delete(ctx, uploadID)

	return file, nil
}

func (s *FileService) GetByID(ctx context.Context, userID, fileID uuid.UUID) (*models.FileDetailResponse, error) {
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return nil, err
	}

	if file.UserID != userID {
		return nil, repository.ErrFileNotFound
	}

	// Generate download URL
	downloadURL, err := s.storage.GeneratePresignedGetURL(ctx, s.storage.BucketFiles(), file.StoragePath, time.Hour)
	if err != nil {
		return nil, err
	}

	response := &models.FileDetailResponse{
		ID:               file.ID,
		Filename:         file.Filename,
		OriginalFilename: file.OriginalFilename,
		FolderID:         file.FolderID,
		StoragePath:      file.StoragePath,
		MimeType:         file.MimeType,
		FileSize:         file.FileSize,
		PageCount:        file.PageCount,
		Status:           file.Status,
		ErrorMessage:     file.ErrorMessage,
		UploadedAt:       file.UploadedAt,
		ProcessedAt:      file.ProcessedAt,
		CreatedAt:        file.CreatedAt,
		UpdatedAt:        file.UpdatedAt,
		DownloadURL:      downloadURL.String(),
	}

	// Get folder info if exists
	if file.FolderID != nil {
		folder, err := s.folderRepo.GetByID(ctx, *file.FolderID)
		if err == nil {
			response.Folder = &models.FolderInfo{
				ID:   folder.ID,
				Name: folder.Name,
			}
		}
	}

	// Get summary brief if exists
	summaryBrief, err := s.summaryRepo.GetBriefByFileID(ctx, fileID)
	if err == nil && summaryBrief != nil {
		response.Summary = summaryBrief
	}

	return response, nil
}

func (s *FileService) List(ctx context.Context, params repository.FileListParams) ([]*models.FileResponse, int64, error) {
	files, totalCount, err := s.fileRepo.List(ctx, params)
	if err != nil {
		return nil, 0, err
	}

	var responses []*models.FileResponse
	for _, f := range files {
		responses = append(responses, &models.FileResponse{
			ID:               f.ID,
			Filename:         f.Filename,
			OriginalFilename: f.OriginalFilename,
			FolderID:         f.FolderID,
			FileSize:         f.FileSize,
			PageCount:        f.PageCount,
			Status:           f.Status,
			HasSummary:       f.HasSummary,
			UploadedAt:       f.UploadedAt,
			ProcessedAt:      f.ProcessedAt,
		})
	}

	return responses, totalCount, nil
}

func (s *FileService) Move(ctx context.Context, userID, fileID uuid.UUID, folderID *uuid.UUID) error {
	// Validate folder if provided
	if folderID != nil {
		folder, err := s.folderRepo.GetByID(ctx, *folderID)
		if err != nil {
			return repository.ErrFolderNotFound
		}
		if folder.UserID != userID {
			return repository.ErrFolderNotFound
		}
	}

	return s.fileRepo.Move(ctx, fileID, userID, folderID)
}

func (s *FileService) Rename(ctx context.Context, userID, fileID uuid.UUID, newName string) error {
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return err
	}

	if file.UserID != userID {
		return repository.ErrFileNotFound
	}

	return s.fileRepo.Rename(ctx, fileID, userID, newName)
}

func (s *FileService) Delete(ctx context.Context, userID, fileID uuid.UUID) error {
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return err
	}

	if file.UserID != userID {
		return repository.ErrFileNotFound
	}

	// Delete from storage
	_ = s.storage.DeleteObject(ctx, s.storage.BucketFiles(), file.StoragePath)

	// Delete from database (cascades to summaries)
	return s.fileRepo.Delete(ctx, fileID, userID)
}

func (s *FileService) GetDownloadURL(ctx context.Context, userID, fileID uuid.UUID, expiresIn time.Duration) (string, string, error) {
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return "", "", err
	}

	if file.UserID != userID {
		return "", "", repository.ErrFileNotFound
	}

	url, err := s.storage.GeneratePresignedGetURL(ctx, s.storage.BucketFiles(), file.StoragePath, expiresIn)
	if err != nil {
		return "", "", err
	}

	return url.String(), file.OriginalFilename, nil
}

func generateSafeFilename(filename string) string {
	// Remove path separators and keep only the base name
	filename = filepath.Base(filename)

	// Replace spaces with hyphens
	filename = strings.ReplaceAll(filename, " ", "-")

	// Convert to lowercase
	filename = strings.ToLower(filename)

	return filename
}
