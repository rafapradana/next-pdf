package server

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/nextpdf/backend/internal/config"
	"github.com/nextpdf/backend/internal/database"
	"github.com/nextpdf/backend/internal/handler"
	"github.com/nextpdf/backend/internal/middleware"
	"github.com/nextpdf/backend/internal/models"
	"github.com/nextpdf/backend/internal/repository"
	"github.com/nextpdf/backend/internal/service"
	"github.com/nextpdf/backend/internal/storage"
)

func New(cfg *config.Config, db *database.DB, store *storage.Storage) *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: errorHandler,
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORSOrigins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-Requested-With",
		AllowCredentials: true,
		ExposeHeaders:    "X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset",
	}))
	app.Use(middleware.RateLimitMiddleware(cfg.RateLimit))

	// Initialize repositories
	userRepo := repository.NewUserRepository(db.Pool)
	tokenRepo := repository.NewTokenRepository(db.Pool)
	sessionRepo := repository.NewSessionRepository(db.Pool)
	folderRepo := repository.NewFolderRepository(db.Pool)
	fileRepo := repository.NewFileRepository(db.Pool)
	pendingUploadRepo := repository.NewPendingUploadRepository(db.Pool)
	summaryRepo := repository.NewSummaryRepository(db.Pool)
	jobRepo := repository.NewProcessingJobRepository(db.Pool)

	// Initialize services
	authService := service.NewAuthService(userRepo, tokenRepo, sessionRepo, cfg.JWT)
	userService := service.NewUserService(userRepo, sessionRepo)
	folderService := service.NewFolderService(folderRepo, fileRepo, store)
	fileService := service.NewFileService(fileRepo, folderRepo, pendingUploadRepo, summaryRepo, store, cfg.Upload)
	aiClient := service.NewAIClient()
	summaryService := service.NewSummaryService(summaryRepo, fileRepo, jobRepo, aiClient)
	uploadService := service.NewUploadService(userRepo, pendingUploadRepo, store)

	// Initialize handlers
	authHandler := handler.NewAuthHandler(authService)
	userHandler := handler.NewUserHandler(userService)
	folderHandler := handler.NewFolderHandler(folderService)
	fileHandler := handler.NewFileHandler(fileService)
	summaryHandler := handler.NewSummaryHandler(summaryService)
	uploadHandler := handler.NewUploadHandler(uploadService)

	// Auth middleware
	authMiddleware := middleware.AuthMiddleware(authService)

	// Routes
	api := app.Group("/api/v1")

	// Health check
	api.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// Auth routes (public)
	auth := api.Group("/auth")
	auth.Post("/register", authHandler.Register)
	auth.Post("/login", authHandler.Login)
	auth.Post("/refresh", authHandler.Refresh)
	auth.Post("/logout", authMiddleware, authHandler.Logout)
	auth.Post("/logout-all", authMiddleware, authHandler.LogoutAll)
	auth.Get("/sessions", authMiddleware, userHandler.GetSessions)
	auth.Delete("/sessions/:session_id", authMiddleware, userHandler.RevokeSession)

	// User routes (protected)
	api.Get("/me", authMiddleware, userHandler.GetMe)
	api.Patch("/me", authMiddleware, userHandler.UpdateMe)
	api.Patch("/me/password", authMiddleware, userHandler.ChangePassword)

	// Folder routes (protected)
	folders := api.Group("/folders", authMiddleware)
	folders.Get("/tree", folderHandler.GetTree)
	folders.Post("/", folderHandler.Create)
	folders.Put("/:id", folderHandler.Update)
	folders.Patch("/:id/move", folderHandler.Move)
	folders.Delete("/:id", folderHandler.Delete)

	// File routes (protected)
	files := api.Group("/files", authMiddleware)
	files.Get("/", fileHandler.List)
	files.Get("/:id", fileHandler.GetByID)
	files.Patch("/:id/move", fileHandler.Move)
	files.Patch("/:id/rename", fileHandler.Rename)
	files.Delete("/:id", fileHandler.Delete)
	files.Post("/upload/presign", fileHandler.Presign)
	files.Post("/upload/confirm", fileHandler.ConfirmUpload)
	files.Post("/:id/summarize-stream", fileHandler.SummarizeStream)
	files.Get("/:id/download", fileHandler.GetDownloadURL)

	// Summary routes (protected)
	summaries := api.Group("/summaries", authMiddleware)
	summaries.Get("/:file_id", summaryHandler.GetByFileID)
	summaries.Get("/:file_id/history", summaryHandler.GetHistory)
	summaries.Post("/:file_id/generate", summaryHandler.Generate)

	// Summary styles (protected)
	api.Get("/summary-styles", authMiddleware, summaryHandler.GetStyles)

	// Upload routes (protected) - Avatar
	uploads := api.Group("/uploads", authMiddleware)
	uploads.Post("/avatar/presign", uploadHandler.AvatarPresign)
	uploads.Post("/avatar/confirm", uploadHandler.AvatarConfirm)

	// Internal routes (for AI service callback - no auth required)
	internalHandler := handler.NewInternalHandler(summaryService)
	internal := api.Group("/internal")
	internal.Post("/summaries/callback", internalHandler.SummaryCallback)

	// Guest routes (public - for trying the service without auth)
	guestHandler := handler.NewGuestHandler()
	guest := api.Group("/guest")
	guest.Post("/summarize", guestHandler.Summarize)
	guest.Post("/summarize-stream", guestHandler.SummarizeStream)

	return app
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Internal server error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message
	}

	return c.Status(code).JSON(models.NewErrorResponse("INTERNAL_ERROR", message))
}
