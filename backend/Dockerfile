# Backend Dockerfile - Go/Fiber
# Multi-stage build for minimal production image

# Stage 1: Build the Go binary
FROM golang:1.22-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/server ./cmd/api

# Install golang-migrate (Pinned to v4.18.1 to avoid Go 1.24 requirement)
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@v4.18.1

# Stage 2: Minimal production image
FROM alpine:3.19
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata wget

# Copy binary from builder
COPY --from=builder /app/server .

# Copy any additional files if needed (migrations, etc)
COPY --from=builder /app/db ./db
COPY --from=builder /go/bin/migrate /usr/local/bin/migrate

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

CMD ["./server"]
