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
	client        *minio.Client
	presignClient *minio.Client
	cfg           config.MinIOConfig
}

func New(cfg config.MinIOConfig) (*Storage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	// Initialize presign client with public endpoint (for correct signature generation)
	// If PublicEndpoint is not set or same as Endpoint, it will match client
	presignEndpoint := cfg.Endpoint
	if cfg.PublicEndpoint != "" {
		presignEndpoint = cfg.PublicEndpoint
	}

	presignClient, err := minio.New(presignEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
		Region: "us-east-1",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio presign client: %w", err)
	}

	return &Storage{
		client:        client,
		presignClient: presignClient,
		cfg:           cfg,
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
	// Use presignClient to generate URL with public endpoint and correct signature
	return s.presignClient.PresignedPutObject(ctx, bucket, objectName, s.cfg.PresignExpiryMin)
}

func (s *Storage) GeneratePresignedGetURL(ctx context.Context, bucket, objectName string, expiry time.Duration) (*url.URL, error) {
	reqParams := make(url.Values)
	// Use presignClient to generate URL with public endpoint and correct signature
	return s.presignClient.PresignedGetObject(ctx, bucket, objectName, expiry, reqParams)
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
	host := s.cfg.Endpoint
	if s.cfg.PublicEndpoint != "" {
		host = s.cfg.PublicEndpoint
	}
	return fmt.Sprintf("%s://%s/%s/%s", protocol, host, bucket, objectName)
}
