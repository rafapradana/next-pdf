package service

import (
	"context"
	"fmt"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/storage"
)

type UploadService struct {
	userRepo          *repository.UserRepository
	pendingUploadRepo *repository.PendingUploadRepository
	storage           *storage.Storage
}

func NewUploadService(
	userRepo *repository.UserRepository,
	pendingUploadRepo *repository.PendingUploadRepository,
	storage *storage.Storage,
) *UploadService {
	return &UploadService{
		userRepo:          userRepo,
		pendingUploadRepo: pendingUploadRepo,
		storage:           storage,
	}
}

var allowedAvatarTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

const maxAvatarSize int64 = 5 * 1024 * 1024 // 5 MB

func (s *UploadService) CreateAvatarPresignedUpload(ctx context.Context, userID uuid.UUID, req *models.AvatarPresignRequest) (*models.AvatarPresignResponse, error) {
	// Validate content type
	ext, ok := allowedAvatarTypes[req.ContentType]
	if !ok {
		return nil, fmt.Errorf("invalid content type: only JPEG, PNG, and WebP images are allowed")
	}

	// Validate file size
	if req.FileSize > maxAvatarSize {
		return nil, fmt.Errorf("file size exceeds maximum limit of 5 MB")
	}

	// Generate storage path
	uploadID := uuid.New()
	storagePath := fmt.Sprintf("avatars/%s/%s%s", userID.String(), uploadID.String(), ext)

	// Generate presigned URL
	presignedURL, err := s.storage.GeneratePresignedPutURL(ctx, s.storage.BucketAvatars(), storagePath, req.ContentType, req.FileSize)
	if err != nil {
		return nil, err
	}

	// Create pending upload record
	expiresAt := time.Now().Add(s.storage.PresignExpiry())
	pendingUpload := &models.PendingUpload{
		UserID:      userID,
		Filename:    req.Filename,
		FileSize:    req.FileSize,
		ContentType: req.ContentType,
		StoragePath: storagePath,
		ExpiresAt:   expiresAt,
	}

	if err := s.pendingUploadRepo.Create(ctx, pendingUpload); err != nil {
		return nil, err
	}

	return &models.AvatarPresignResponse{
		UploadID:     pendingUpload.ID,
		PresignedURL: presignedURL.String(),
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *UploadService) ConfirmAvatarUpload(ctx context.Context, userID uuid.UUID, uploadID uuid.UUID) (string, error) {
	// Get pending upload
	pendingUpload, err := s.pendingUploadRepo.GetByID(ctx, uploadID)
	if err != nil {
		return "", err
	}

	if pendingUpload.UserID != userID {
		return "", repository.ErrUploadNotFound
	}

	// Verify file exists in storage
	exists, err := s.storage.ObjectExists(ctx, s.storage.BucketAvatars(), pendingUpload.StoragePath)
	if err != nil {
		return "", err
	}
	if !exists {
		return "", fmt.Errorf("file not found in storage")
	}

	// Generate public URL for avatar
	avatarURL := s.storage.GetPublicURL(s.storage.BucketAvatars(), pendingUpload.StoragePath)

	// Update user's avatar URL
	if err := s.userRepo.UpdateAvatar(ctx, userID, avatarURL); err != nil {
		return "", err
	}

	// Delete pending upload
	_ = s.pendingUploadRepo.Delete(ctx, uploadID)

	return avatarURL, nil
}

func getExtension(filename string) string {
	ext := filepath.Ext(filename)
	if ext == "" {
		return ".jpg"
	}
	return ext
}
