package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var ErrInvalidPassword = errors.New("current password is incorrect")

type UserService struct {
	userRepo    *repository.UserRepository
	sessionRepo *repository.SessionRepository
}

func NewUserService(userRepo *repository.UserRepository, sessionRepo *repository.SessionRepository) *UserService {
	return &UserService{
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
	}
}

func (s *UserService) GetByID(ctx context.Context, id uuid.UUID) (*models.User, error) {
	return s.userRepo.GetByID(ctx, id)
}

func (s *UserService) UpdateProfile(ctx context.Context, userID uuid.UUID, req *models.UpdateProfileRequest) (*models.User, error) {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	if req.FullName != nil {
		user.FullName = req.FullName
	}
	if req.AvatarURL != nil {
		user.AvatarURL = req.AvatarURL
	}

	if err := s.userRepo.Update(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *UserService) ChangePassword(ctx context.Context, userID uuid.UUID, req *models.ChangePasswordRequest) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return err
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return ErrInvalidPassword
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	return s.userRepo.UpdatePassword(ctx, userID, string(hashedPassword))
}

func (s *UserService) GetSessions(ctx context.Context, userID uuid.UUID, currentTokenID *uuid.UUID) ([]*models.UserSession, error) {
	return s.sessionRepo.GetByUserID(ctx, userID, currentTokenID)
}

func (s *UserService) RevokeSession(ctx context.Context, userID, sessionID uuid.UUID) error {
	session, err := s.sessionRepo.GetByID(ctx, sessionID)
	if err != nil {
		return err
	}

	if session.UserID != userID {
		return repository.ErrSessionNotFound
	}

	return s.sessionRepo.Delete(ctx, sessionID)
}
