package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID              uuid.UUID  `json:"id"`
	Email           string     `json:"email"`
	PasswordHash    string     `json:"-"`
	FullName        *string    `json:"full_name"`
	AvatarURL       *string    `json:"avatar_url"`
	IsActive        bool       `json:"is_active"`
	EmailVerifiedAt *time.Time `json:"email_verified_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type UserResponse struct {
	ID              uuid.UUID  `json:"id"`
	Email           string     `json:"email"`
	FullName        *string    `json:"full_name,omitempty"`
	AvatarURL       *string    `json:"avatar_url,omitempty"`
	IsActive        bool       `json:"is_active,omitempty"`
	EmailVerifiedAt *time.Time `json:"email_verified_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at,omitempty"`
}

func (u *User) ToResponse() *UserResponse {
	return &UserResponse{
		ID:              u.ID,
		Email:           u.Email,
		FullName:        u.FullName,
		AvatarURL:       u.AvatarURL,
		IsActive:        u.IsActive,
		EmailVerifiedAt: u.EmailVerifiedAt,
		CreatedAt:       u.CreatedAt,
		UpdatedAt:       u.UpdatedAt,
	}
}

type RefreshToken struct {
	ID         uuid.UUID  `json:"id"`
	UserID     uuid.UUID  `json:"user_id"`
	TokenHash  string     `json:"-"`
	DeviceInfo *string    `json:"device_info"`
	IPAddress  *string    `json:"ip_address"`
	ExpiresAt  time.Time  `json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at"`
	CreatedAt  time.Time  `json:"created_at"`
}

type UserSession struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"user_id"`
	RefreshTokenID *uuid.UUID `json:"refresh_token_id"`
	IPAddress      *string    `json:"ip_address"`
	UserAgent      *string    `json:"user_agent"`
	LastActiveAt   time.Time  `json:"last_active_at"`
	CreatedAt      time.Time  `json:"created_at"`
	IsCurrent      bool       `json:"is_current"`
}
