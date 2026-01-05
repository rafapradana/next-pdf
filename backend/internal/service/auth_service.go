package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/nextpdf/backend/internal/config"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrAccountDisabled    = errors.New("account is disabled")
	ErrInvalidToken       = errors.New("invalid token")
	ErrTokenExpired       = errors.New("token has expired")
)

type AuthService struct {
	userRepo    *repository.UserRepository
	tokenRepo   *repository.TokenRepository
	sessionRepo *repository.SessionRepository
	jwtConfig   config.JWTConfig
}

func NewAuthService(
	userRepo *repository.UserRepository,
	tokenRepo *repository.TokenRepository,
	sessionRepo *repository.SessionRepository,
	jwtConfig config.JWTConfig,
) *AuthService {
	return &AuthService{
		userRepo:    userRepo,
		tokenRepo:   tokenRepo,
		sessionRepo: sessionRepo,
		jwtConfig:   jwtConfig,
	}
}

func (s *AuthService) Register(ctx context.Context, req *models.RegisterRequest) (*models.User, error) {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		FullName:     req.FullName,
	}

	if err := s.userRepo.Create(ctx, user); err != nil {
		return nil, err
	}

	return user, nil
}

func (s *AuthService) Login(ctx context.Context, req *models.LoginRequest, deviceInfo, ipAddress string) (*models.LoginResponse, string, error) {
	// Get user by email
	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		if errors.Is(err, repository.ErrUserNotFound) {
			return nil, "", ErrInvalidCredentials
		}
		return nil, "", err
	}

	// Check if account is active
	if !user.IsActive {
		return nil, "", ErrAccountDisabled
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, "", ErrInvalidCredentials
	}

	// Generate tokens
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, "", err
	}

	refreshToken, refreshTokenHash, err := s.generateRefreshToken()
	if err != nil {
		return nil, "", err
	}

	// Store refresh token
	tokenRecord := &models.RefreshToken{
		UserID:     user.ID,
		TokenHash:  refreshTokenHash,
		DeviceInfo: &deviceInfo,
		IPAddress:  &ipAddress,
		ExpiresAt:  time.Now().Add(s.jwtConfig.RefreshExpiryDays),
	}

	if err := s.tokenRepo.CreateRefreshToken(ctx, tokenRecord); err != nil {
		return nil, "", err
	}

	// Create session
	session := &models.UserSession{
		UserID:         user.ID,
		RefreshTokenID: &tokenRecord.ID,
		IPAddress:      &ipAddress,
		UserAgent:      &deviceInfo,
	}

	if err := s.sessionRepo.Create(ctx, session); err != nil {
		return nil, "", err
	}

	return &models.LoginResponse{
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   int(s.jwtConfig.AccessExpiryMins.Seconds()),
		User:        user.ToResponse(),
	}, refreshToken, nil
}

func (s *AuthService) RefreshToken(ctx context.Context, refreshToken string) (*models.RefreshResponse, string, error) {
	// Hash the provided token
	tokenHash := hashToken(refreshToken)

	// Get token from database
	tokenRecord, err := s.tokenRepo.GetRefreshTokenByHash(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, repository.ErrTokenNotFound) || errors.Is(err, repository.ErrTokenRevoked) {
			return nil, "", ErrInvalidToken
		}
		if errors.Is(err, repository.ErrTokenExpired) {
			return nil, "", ErrTokenExpired
		}
		return nil, "", err
	}

	// Get user
	user, err := s.userRepo.GetByID(ctx, tokenRecord.UserID)
	if err != nil {
		return nil, "", err
	}

	if !user.IsActive {
		return nil, "", ErrAccountDisabled
	}

	// Revoke old token
	if err := s.tokenRepo.RevokeRefreshToken(ctx, tokenHash); err != nil {
		return nil, "", err
	}

	// Generate new tokens
	accessToken, err := s.generateAccessToken(user)
	if err != nil {
		return nil, "", err
	}

	newRefreshToken, newRefreshTokenHash, err := s.generateRefreshToken()
	if err != nil {
		return nil, "", err
	}

	// Store new refresh token
	newTokenRecord := &models.RefreshToken{
		UserID:     user.ID,
		TokenHash:  newRefreshTokenHash,
		DeviceInfo: tokenRecord.DeviceInfo,
		IPAddress:  tokenRecord.IPAddress,
		ExpiresAt:  time.Now().Add(s.jwtConfig.RefreshExpiryDays),
	}

	if err := s.tokenRepo.CreateRefreshToken(ctx, newTokenRecord); err != nil {
		return nil, "", err
	}

	return &models.RefreshResponse{
		AccessToken: accessToken,
		TokenType:   "Bearer",
		ExpiresIn:   int(s.jwtConfig.AccessExpiryMins.Seconds()),
	}, newRefreshToken, nil
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	tokenHash := hashToken(refreshToken)
	return s.tokenRepo.RevokeRefreshToken(ctx, tokenHash)
}

func (s *AuthService) LogoutAll(ctx context.Context, userID uuid.UUID) (int64, error) {
	return s.tokenRepo.RevokeAllUserTokens(ctx, userID)
}

func (s *AuthService) ValidateAccessToken(tokenString string) (*models.TokenClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(s.jwtConfig.AccessSecret), nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, ErrInvalidToken
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, ErrInvalidToken
	}

	userIDStr, ok := claims["sub"].(string)
	if !ok {
		return nil, ErrInvalidToken
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, ErrInvalidToken
	}

	email, _ := claims["email"].(string)

	return &models.TokenClaims{
		UserID: userID,
		Email:  email,
	}, nil
}

func (s *AuthService) generateAccessToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":   user.ID.String(),
		"email": user.Email,
		"iat":   time.Now().Unix(),
		"exp":   time.Now().Add(s.jwtConfig.AccessExpiryMins).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtConfig.AccessSecret))
}

func (s *AuthService) generateRefreshToken() (string, string, error) {
	tokenID := uuid.New().String()
	tokenHash := hashToken(tokenID)
	return tokenID, tokenHash, nil
}

func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
