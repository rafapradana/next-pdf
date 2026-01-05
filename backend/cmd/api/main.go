package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nextpdf/backend/internal/config"
	"github.com/nextpdf/backend/internal/database"
	"github.com/nextpdf/backend/internal/server"
	"github.com/nextpdf/backend/internal/storage"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database
	db, err := database.New(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Initialize MinIO storage
	store, err := storage.New(cfg.MinIO)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	// Create buckets if not exist
	ctx := context.Background()
	if err := store.EnsureBuckets(ctx); err != nil {
		log.Fatalf("Failed to ensure buckets: %v", err)
	}

	// Create and start server
	srv := server.New(cfg, db, store)

	// Graceful shutdown
	go func() {
		if err := srv.Listen(cfg.Server.Address()); err != nil {
			log.Fatalf("Server error: %v", err)
		}
	}()

	log.Printf("Server started on %s", cfg.Server.Address())

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.ShutdownWithContext(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}
