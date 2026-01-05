package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/nextpdf/backend/internal/config"
)

type Storage struct {
	client *minio.Client
	cfg    config.MinIOConfig
}

func New(cfg config.MinIOConfig) (*Storage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	return &Storage{
		client: client,
		cfg:    cfg,
	}, nil
}

func (s *Storage) EnsureBuckets(ctx context.Context) error {
	buckets := []string{s.cfg.BucketFiles, s.cfg.BucketAvatars, s.cfg.BucketUploads}

	for _, bucket := range buckets {
		exists, err := s.client.BucketExists(ctx, bucket)
		if err != nil {
			return fmt.Errorf("failed to check bucket %s: %w", bucket, err)
		}

		if !exists {
			if err := s.client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
				return fmt.Errorf("failed to create bucket %s: %w", bucket, err)
			}
		}
	}

	return nil
}

func (s *Storage) GeneratePresignedPutURL(ctx context.Context, bucket, objectName, contentType string, size int64) (*url.URL, error) {
	presignedURL, err := s.client.PresignedPutObject(ctx, bucket, objectName, s.cfg.PresignExpiryMin)
	if err != nil {
		return nil, err
	}
	return s.rewriteURLForPublicAccess(presignedURL), nil
}

func (s *Storage) GeneratePresignedGetURL(ctx context.Context, bucket, objectName string, expiry time.Duration) (*url.URL, error) {
	reqParams := make(url.Values)
	presignedURL, err := s.client.PresignedGetObject(ctx, bucket, objectName, expiry, reqParams)
	if err != nil {
		return nil, err
	}
	return s.rewriteURLForPublicAccess(presignedURL), nil
}

// rewriteURLForPublicAccess replaces internal Docker endpoint with public endpoint
func (s *Storage) rewriteURLForPublicAccess(u *url.URL) *url.URL {
	if s.cfg.PublicEndpoint != "" && s.cfg.PublicEndpoint != s.cfg.Endpoint {
		u.Host = s.cfg.PublicEndpoint
	}
	return u
}

func (s *Storage) ObjectExists(ctx context.Context, bucket, objectName string) (bool, error) {
	_, err := s.client.StatObject(ctx, bucket, objectName, minio.StatObjectOptions{})
	if err != nil {
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

func (s *Storage) DeleteObject(ctx context.Context, bucket, objectName string) error {
	return s.client.RemoveObject(ctx, bucket, objectName, minio.RemoveObjectOptions{})
}

func (s *Storage) GetObject(ctx context.Context, bucket, objectName string) (io.ReadCloser, error) {
	return s.client.GetObject(ctx, bucket, objectName, minio.GetObjectOptions{})
}

func (s *Storage) CopyObject(ctx context.Context, srcBucket, srcObject, dstBucket, dstObject string) error {
	src := minio.CopySrcOptions{
		Bucket: srcBucket,
		Object: srcObject,
	}
	dst := minio.CopyDestOptions{
		Bucket: dstBucket,
		Object: dstObject,
	}
	_, err := s.client.CopyObject(ctx, dst, src)
	return err
}

func (s *Storage) BucketFiles() string {
	return s.cfg.BucketFiles
}

func (s *Storage) BucketAvatars() string {
	return s.cfg.BucketAvatars
}

func (s *Storage) BucketUploads() string {
	return s.cfg.BucketUploads
}

func (s *Storage) PresignExpiry() time.Duration {
	return s.cfg.PresignExpiryMin
}

func (s *Storage) GetPublicURL(bucket, objectName string) string {
	protocol := "http"
	if s.cfg.UseSSL {
		protocol = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", protocol, s.cfg.Endpoint, bucket, objectName)
}
