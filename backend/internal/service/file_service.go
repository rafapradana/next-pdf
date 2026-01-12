package service

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"log"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/ledongthuc/pdf"
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

func (s *FileService) GetFile(ctx context.Context, id uuid.UUID) (*models.File, error) {
	return s.fileRepo.GetByID(ctx, id)
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
		WorkspaceID: req.WorkspaceID,
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

	// Count pages
	var pageCount *int
	if strings.HasPrefix(pendingUpload.ContentType, "application/pdf") {
		log.Printf("Analyzing PDF for page count: %s", pendingUpload.StoragePath)
		obj, err := s.storage.GetObject(ctx, s.storage.BucketUploads(), pendingUpload.StoragePath)
		if err == nil {
			defer obj.Close()
			data, err := io.ReadAll(obj)
			if err == nil {
				reader, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
				if err == nil {
					pc := reader.NumPage()
					log.Printf("Page count for %s: %d", pendingUpload.StoragePath, pc)
					if pc > 0 {
						pageCount = &pc
					}
				} else {
					log.Printf("Failed to create PDF reader: %v", err)
				}
			} else {
				log.Printf("Failed to read object data: %v", err)
			}
		} else {
			log.Printf("Failed to get object for page count: %v", err)
		}
	} else {
		log.Printf("Skipping page count for content type: %s", pendingUpload.ContentType)
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
		WorkspaceID:      pendingUpload.WorkspaceID,
		FolderID:         pendingUpload.FolderID,
		Filename:         safeFilename,
		OriginalFilename: pendingUpload.Filename,
		StoragePath:      pendingUpload.StoragePath,
		MimeType:         pendingUpload.ContentType,
		FileSize:         pendingUpload.FileSize,
		PageCount:        pageCount,
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
		if errors.Is(err, repository.ErrFileNotFound) {
			// If file is already gone, consider it a success (idempotent)
			return nil
		}
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

func (s *FileService) GetFileContent(ctx context.Context, userID, fileID uuid.UUID) (io.ReadCloser, *models.File, error) {
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return nil, nil, err
	}

	if file.UserID != userID {
		return nil, nil, repository.ErrFileNotFound
	}

	content, err := s.storage.GetObject(ctx, s.storage.BucketFiles(), file.StoragePath)
	if err != nil {
		return nil, nil, err
	}

	return content, file, nil
}

func (s *FileService) SaveStreamSummary(ctx context.Context, userID, fileID uuid.UUID, req models.SummaryCallbackRequest) error {
	// 1. Verify file exists and belongs to user
	file, err := s.fileRepo.GetByID(ctx, fileID)
	if err != nil {
		return err
	}
	if file.UserID != userID {
		return repository.ErrFileNotFound
	}

	// 2. Create summary
	summary := &repository.SummaryCreate{
		FileID:               fileID,
		Title:                &req.Title,
		Content:              req.Content,
		Style:                req.Style,
		CustomInstructions:   req.CustomInstructions,
		ModelUsed:            &req.ModelUsed,
		PromptTokens:         &req.PromptTokens,
		CompletionTokens:     &req.CompletionTokens,
		ProcessingDurationMs: &req.ProcessingDurationMs,
		Language:             req.Language,
	}

	if err := s.summaryRepo.Create(ctx, summary); err != nil {
		return err
	}

	// 3. CRITICAL: Update file status to completed so GetByFileID returns the summary
	return s.fileRepo.UpdateStatus(ctx, fileID, models.StatusCompleted, nil)
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

func (s *FileService) ExportToCSV(ctx context.Context, userID uuid.UUID, workspaceID uuid.UUID, params repository.FileListParams, fileIDs []uuid.UUID) (io.Reader, error) {
	// If workspaceID is provided, ensure params filter by it
	if workspaceID != uuid.Nil {
		params.WorkspaceID = &workspaceID
	}
	params.UserID = userID

	// Fetch data
	rows, err := s.fileRepo.Export(ctx, params, fileIDs)
	if err != nil {
		return nil, err
	}

	// Create pipe
	pr, pw := io.Pipe()

	go func() {
		defer pw.Close()

		// Write UTF-8 BOM for Excel compatibility
		pw.Write([]byte{0xEF, 0xBB, 0xBF})

		w := csv.NewWriter(pw)
		defer w.Flush()

		headers := []string{
			"File ID", "Filename", "Original Filename", "Size (Bytes)", "Page Count",
			"Type", "Uploaded At", "Status", "Workspace", "Folder",
			"Summary Version", "Summary Model", "Summary Created At", "Summary Processing Duration (ms)", "Summary Content",
		}
		if err := w.Write(headers); err != nil {
			return // or handle error better, but pipe will close
		}

		for _, r := range rows {
			pageCount := ""
			if r.PageCount != nil {
				pageCount = strconv.Itoa(*r.PageCount)
			}
			record := []string{
				r.ID.String(),
				r.Filename,
				r.OriginalFilename,
				strconv.FormatInt(r.Size, 10),
				pageCount,
				r.MimeType,
				r.UploadedAt.Format(time.RFC3339),
				r.Status,
				r.WorkspaceName,
				r.FolderPath,
			}

			// Add summary fields (handle nil)
			if r.SummaryVersion != nil {
				var createdAt string
				if r.SummaryCreatedAt != nil {
					createdAt = r.SummaryCreatedAt.Format(time.RFC3339)
				}
				duration := ""
				if r.SummaryProcessingDuration != nil {
					duration = strconv.Itoa(*r.SummaryProcessingDuration)
				}
				record = append(record,
					strconv.Itoa(*r.SummaryVersion),
					*r.SummaryModel,
					createdAt,
					duration,
					*r.SummaryContent,
				)
			} else {
				record = append(record, "", "", "", "", "")
			}

			if err := w.Write(record); err != nil {
				return
			}
		}
	}()

	return pr, nil
}

// JSON Export types
type ExportFileSummary struct {
	Version              int       `json:"version"`
	Model                string    `json:"model"`
	CreatedAt            time.Time `json:"created_at"`
	Content              string    `json:"content"`
	ProcessingDurationMs int       `json:"processing_duration_ms"`
}

type ExportFile struct {
	ID               uuid.UUID           `json:"id"`
	Filename         string              `json:"filename"`
	OriginalFilename string              `json:"original_filename"`
	SizeBytes        int64               `json:"size_bytes"`
	PageCount        *int                `json:"page_count"`
	MimeType         string              `json:"mime_type"`
	Status           string              `json:"status"`
	UploadedAt       time.Time           `json:"uploaded_at"`
	Folder           string              `json:"folder"`
	Summaries        []ExportFileSummary `json:"summaries,omitempty"`
}

type ExportData struct {
	ExportedAt time.Time    `json:"exported_at"`
	Workspace  string       `json:"workspace"`
	TotalFiles int          `json:"total_files"`
	Files      []ExportFile `json:"files"`
}

func (s *FileService) ExportToJSON(ctx context.Context, userID uuid.UUID, workspaceID uuid.UUID, params repository.FileListParams, fileIDs []uuid.UUID) (*ExportData, error) {
	if workspaceID != uuid.Nil {
		params.WorkspaceID = &workspaceID
	}
	params.UserID = userID

	rows, err := s.fileRepo.Export(ctx, params, fileIDs)
	if err != nil {
		return nil, err
	}

	// Group rows by file ID (since we may have multiple summary versions per file)
	fileMap := make(map[uuid.UUID]*ExportFile)
	var workspaceName string

	for _, r := range rows {
		workspaceName = r.WorkspaceName

		if existing, ok := fileMap[r.ID]; ok {
			// Add summary to existing file
			if r.SummaryVersion != nil {
				var createdAt time.Time
				if r.SummaryCreatedAt != nil {
					createdAt = *r.SummaryCreatedAt
				}
				model := ""
				if r.SummaryModel != nil {
					model = *r.SummaryModel
				}
				content := ""
				if r.SummaryContent != nil {
					content = *r.SummaryContent
				}
				duration := 0
				if r.SummaryProcessingDuration != nil {
					duration = *r.SummaryProcessingDuration
				}
				existing.Summaries = append(existing.Summaries, ExportFileSummary{
					Version:              *r.SummaryVersion,
					Model:                model,
					CreatedAt:            createdAt,
					Content:              content,
					ProcessingDurationMs: duration,
				})
			}
		} else {
			// Create new file entry
			file := &ExportFile{
				ID:               r.ID,
				Filename:         r.Filename,
				OriginalFilename: r.OriginalFilename,
				SizeBytes:        r.Size,
				PageCount:        r.PageCount,
				MimeType:         r.MimeType,
				Status:           r.Status,
				UploadedAt:       r.UploadedAt,
				Folder:           r.FolderPath,
				Summaries:        []ExportFileSummary{},
			}

			if r.SummaryVersion != nil {
				var createdAt time.Time
				if r.SummaryCreatedAt != nil {
					createdAt = *r.SummaryCreatedAt
				}
				model := ""
				if r.SummaryModel != nil {
					model = *r.SummaryModel
				}
				content := ""
				if r.SummaryContent != nil {
					content = *r.SummaryContent
				}
				duration := 0
				if r.SummaryProcessingDuration != nil {
					duration = *r.SummaryProcessingDuration
				}
				file.Summaries = append(file.Summaries, ExportFileSummary{
					Version:              *r.SummaryVersion,
					Model:                model,
					CreatedAt:            createdAt,
					Content:              content,
					ProcessingDurationMs: duration,
				})
			}

			fileMap[r.ID] = file
		}
	}

	// Convert to slice
	files := make([]ExportFile, 0, len(fileMap))
	for _, f := range fileMap {
		files = append(files, *f)
	}

	return &ExportData{
		ExportedAt: time.Now(),
		Workspace:  workspaceName,
		TotalFiles: len(files),
		Files:      files,
	}, nil
}
