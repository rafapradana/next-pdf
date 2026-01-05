package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nextpdf/backend/internal/models"
)

var (
	ErrTokenNotFound = errors.New("token not found")
	ErrTokenRevoked  = errors.New("token has been revoked")
	ErrTokenExpired  = errors.New("token has expired")
)

type TokenRepository struct {
	db *pgxpool.Pool
}

func NewTokenRepository(db *pgxpool.Pool) *TokenRepository {
	return &TokenRepository{db: db}
}

func (r *TokenRepository) CreateRefreshToken(ctx context.Context, token *models.RefreshToken) error {
	query := `
		INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
		VALUES ($1, $2, $3, $4::inet, $5)
		RETURNING id, created_at
	`

	return r.db.QueryRow(ctx, query,
		token.UserID, token.TokenHash, token.DeviceInfo, token.IPAddress, token.ExpiresAt,
	).Scan(&token.ID, &token.CreatedAt)
}

func (r *TokenRepository) GetRefreshTokenByHash(ctx context.Context, tokenHash string) (*models.RefreshToken, error) {
	query := `
		SELECT id, user_id, token_hash, device_info, ip_address::text, expires_at, revoked_at, created_at
		FROM refresh_tokens
		WHERE token_hash = $1
	`

	token := &models.RefreshToken{}
	err := r.db.QueryRow(ctx, query, tokenHash).Scan(
		&token.ID, &token.UserID, &token.TokenHash, &token.DeviceInfo,
		&token.IPAddress, &token.ExpiresAt, &token.RevokedAt, &token.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrTokenNotFound
		}
		return nil, err
	}

	if token.RevokedAt != nil {
		return nil, ErrTokenRevoked
	}

	if token.ExpiresAt.Before(time.Now()) {
		return nil, ErrTokenExpired
	}

	return token, nil
}

func (r *TokenRepository) RevokeRefreshToken(ctx context.Context, tokenHash string) error {
	query := `
		UPDATE refresh_tokens
		SET revoked_at = NOW()
		WHERE token_hash = $1 AND revoked_at IS NULL
	`

	result, err := r.db.Exec(ctx, query, tokenHash)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrTokenNotFound
	}

	return nil
}

func (r *TokenRepository) RevokeAllUserTokens(ctx context.Context, userID uuid.UUID) (int64, error) {
	query := `
		UPDATE refresh_tokens
		SET revoked_at = NOW()
		WHERE user_id = $1 AND revoked_at IS NULL
	`

	result, err := r.db.Exec(ctx, query, userID)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected(), nil
}

func (r *TokenRepository) RevokeTokenByID(ctx context.Context, tokenID uuid.UUID) error {
	query := `
		UPDATE refresh_tokens
		SET revoked_at = NOW()
		WHERE id = $1 AND revoked_at IS NULL
	`

	result, err := r.db.Exec(ctx, query, tokenID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrTokenNotFound
	}

	return nil
}

func (r *TokenRepository) CleanupExpiredTokens(ctx context.Context) (int64, error) {
	query := `
		DELETE FROM refresh_tokens
		WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days')
	`

	result, err := r.db.Exec(ctx, query)
	if err != nil {
		return 0, err
	}

	return result.RowsAffected(), nil
}
