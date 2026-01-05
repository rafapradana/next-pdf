package models

import "github.com/google/uuid"

type RegisterRequest struct {
	Email    string  `json:"email" validate:"required,email"`
	Password string  `json:"password" validate:"required,min=8"`
	FullName *string `json:"full_name" validate:"omitempty,max=255"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type LoginResponse struct {
	AccessToken string        `json:"access_token"`
	TokenType   string        `json:"token_type"`
	ExpiresIn   int           `json:"expires_in"`
	User        *UserResponse `json:"user"`
}

type RefreshResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type LogoutAllResponse struct {
	SessionsTerminated int `json:"sessions_terminated"`
}

type UpdateProfileRequest struct {
	FullName  *string `json:"full_name" validate:"omitempty,max=255"`
	AvatarURL *string `json:"avatar_url" validate:"omitempty,url"`
}

type ChangePasswordRequest struct {
	CurrentPassword         string `json:"current_password" validate:"required"`
	NewPassword             string `json:"new_password" validate:"required,min=8"`
	NewPasswordConfirmation string `json:"new_password_confirmation" validate:"required,eqfield=NewPassword"`
}

type TokenClaims struct {
	UserID uuid.UUID `json:"sub"`
	Email  string    `json:"email"`
}
