package repository

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nextpdf/backend/internal/models"
)

var ErrSessionNotFound = errors.New("session not found")

type SessionRepository struct {
	db *pgxpool.Pool
}

func NewSessionRepository(db *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{db: db}
}

func (r *SessionRepository) Create(ctx context.Context, session *models.UserSession) error {
	query := `
		INSERT INTO user_sessions (user_id, refresh_token_id, ip_address, user_agent)
		VALUES ($1, $2, $3::inet, $4)
		RETURNING id, last_active_at, created_at
	`

	return r.db.QueryRow(ctx, query,
		session.UserID, session.RefreshTokenID, session.IPAddress, session.UserAgent,
	).Scan(&session.ID, &session.LastActiveAt, &session.CreatedAt)
}

func (r *SessionRepository) GetByUserID(ctx context.Context, userID uuid.UUID, currentTokenID *uuid.UUID) ([]*models.UserSession, error) {
	query := `
		SELECT us.id, us.user_id, us.refresh_token_id, us.ip_address::text, us.user_agent, 
		       us.last_active_at, us.created_at,
		       CASE WHEN us.refresh_token_id = $2 THEN true ELSE false END as is_current
		FROM user_sessions us
		JOIN refresh_tokens rt ON us.refresh_token_id = rt.id
		WHERE us.user_id = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW()
		ORDER BY us.last_active_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID, currentTokenID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*models.UserSession
	for rows.Next() {
		session := &models.UserSession{}
		err := rows.Scan(
			&session.ID, &session.UserID, &session.RefreshTokenID, &session.IPAddress,
			&session.UserAgent, &session.LastActiveAt, &session.CreatedAt, &session.IsCurrent,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}

	return sessions, nil
}

func (r *SessionRepository) GetByID(ctx context.Context, sessionID uuid.UUID) (*models.UserSession, error) {
	query := `
		SELECT id, user_id, refresh_token_id, ip_address::text, user_agent, last_active_at, created_at
		FROM user_sessions
		WHERE id = $1
	`

	session := &models.UserSession{}
	err := r.db.QueryRow(ctx, query, sessionID).Scan(
		&session.ID, &session.UserID, &session.RefreshTokenID, &session.IPAddress,
		&session.UserAgent, &session.LastActiveAt, &session.CreatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSessionNotFound
		}
		return nil, err
	}

	return session, nil
}

func (r *SessionRepository) UpdateLastActive(ctx context.Context, sessionID uuid.UUID) error {
	query := `
		UPDATE user_sessions
		SET last_active_at = NOW()
		WHERE id = $1
	`

	_, err := r.db.Exec(ctx, query, sessionID)
	return err
}

func (r *SessionRepository) Delete(ctx context.Context, sessionID uuid.UUID) error {
	query := `DELETE FROM user_sessions WHERE id = $1`

	result, err := r.db.Exec(ctx, query, sessionID)
	if err != nil {
		return err
	}

	if result.RowsAffected() == 0 {
		return ErrSessionNotFound
	}

	return nil
}

func (r *SessionRepository) DeleteByRefreshTokenID(ctx context.Context, tokenID uuid.UUID) error {
	query := `DELETE FROM user_sessions WHERE refresh_token_id = $1`
	_, err := r.db.Exec(ctx, query, tokenID)
	return err
}
