package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server      ServerConfig
	Database    DatabaseConfig
	JWT         JWTConfig
	MinIO       MinIOConfig
	RateLimit   RateLimitConfig
	Upload      UploadConfig
	CORSOrigins string
}

type ServerConfig struct {
	Host string
	Port string
	Env  string
}

func (s ServerConfig) Address() string {
	return fmt.Sprintf("%s:%s", s.Host, s.Port)
}

func (s ServerConfig) IsDevelopment() bool {
	return s.Env == "development"
}

type DatabaseConfig struct {
	Host           string
	Port           string
	User           string
	Password       string
	Name           string
	SSLMode        string
	MaxConnections int
	MaxIdleConns   int
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.Name, d.SSLMode,
	)
}

type JWTConfig struct {
	AccessSecret      string
	RefreshSecret     string
	AccessExpiryMins  time.Duration
	RefreshExpiryDays time.Duration
}

type MinIOConfig struct {
	Endpoint         string
	PublicEndpoint   string // Browser-accessible endpoint
	AccessKey        string
	SecretKey        string
	UseSSL           bool
	BucketFiles      string
	BucketAvatars    string
	BucketUploads    string
	PresignExpiryMin time.Duration
}

type RateLimitConfig struct {
	Max        int
	ExpirySecs int
}

type UploadConfig struct {
	MaxFileSizeMB int64
}

func Load() (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Host: getEnv("SERVER_HOST", "0.0.0.0"),
			Port: getEnv("SERVER_PORT", "8080"),
			Env:  getEnv("APP_ENV", "development"),
		},
		Database: DatabaseConfig{
			Host:           getEnv("DB_HOST", "localhost"),
			Port:           getEnv("DB_PORT", "5432"),
			User:           getEnv("DB_USER", "postgres"),
			Password:       getEnv("DB_PASSWORD", "postgres"),
			Name:           getEnv("DB_NAME", "nextpdf"),
			SSLMode:        getEnv("DB_SSLMODE", "disable"),
			MaxConnections: getEnvInt("DB_MAX_CONNECTIONS", 25),
			MaxIdleConns:   getEnvInt("DB_MAX_IDLE_CONNECTIONS", 5),
		},
		JWT: JWTConfig{
			AccessSecret:      getEnv("JWT_ACCESS_SECRET", "access-secret"),
			RefreshSecret:     getEnv("JWT_REFRESH_SECRET", "refresh-secret"),
			AccessExpiryMins:  time.Duration(getEnvInt("JWT_ACCESS_EXPIRY_MINUTES", 15)) * time.Minute,
			RefreshExpiryDays: time.Duration(getEnvInt("JWT_REFRESH_EXPIRY_DAYS", 7)) * 24 * time.Hour,
		},
		MinIO: MinIOConfig{
			Endpoint:         getEnv("MINIO_ENDPOINT", "localhost:9000"),
			PublicEndpoint:   getEnv("MINIO_PUBLIC_ENDPOINT", getEnv("MINIO_ENDPOINT", "localhost:9000")),
			AccessKey:        getEnv("MINIO_ACCESS_KEY", "minioadmin"),
			SecretKey:        getEnv("MINIO_SECRET_KEY", "minioadmin"),
			UseSSL:           getEnvBool("MINIO_USE_SSL", false),
			BucketFiles:      getEnv("MINIO_BUCKET_FILES", "nextpdf-files"),
			BucketAvatars:    getEnv("MINIO_BUCKET_AVATARS", "nextpdf-avatars"),
			BucketUploads:    getEnv("MINIO_BUCKET_UPLOADS", "nextpdf-uploads"),
			PresignExpiryMin: time.Duration(getEnvInt("MINIO_PRESIGN_EXPIRY_MINUTES", 15)) * time.Minute,
		},
		RateLimit: RateLimitConfig{
			Max:        getEnvInt("RATE_LIMIT_MAX", 1000),
			ExpirySecs: getEnvInt("RATE_LIMIT_EXPIRY_SECONDS", 60),
		},
		Upload: UploadConfig{
			MaxFileSizeMB: int64(getEnvInt("MAX_FILE_SIZE_MB", 25)),
		},
		CORSOrigins: getEnv("CORS_ORIGINS", "http://localhost:3000"),
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}
