package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/nextpdf/backend/internal/config"
	"github.com/nextpdf/backend/internal/models"
)

func RateLimitMiddleware(cfg config.RateLimitConfig) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        cfg.Max,
		Expiration: time.Duration(cfg.ExpirySecs) * time.Second,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(models.NewErrorResponse(
				"RATE_LIMIT_EXCEEDED",
				"Too many requests. Please try again later.",
			))
		},
		SkipFailedRequests: false,
	})
}
