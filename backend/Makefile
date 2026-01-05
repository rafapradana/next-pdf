.PHONY: build run dev test clean tidy

# Build the application
build:
	go build -o bin/api cmd/api/main.go

# Run the application
run: build
	./bin/api

# Run in development mode with hot reload (requires air)
dev:
	air

# Run tests
test:
	go test -v ./...

# Run tests with coverage
test-coverage:
	go test -v -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html

# Tidy dependencies
tidy:
	go mod tidy

# Download dependencies
deps:
	go mod download

# Format code
fmt:
	go fmt ./...

# Lint code (requires golangci-lint)
lint:
	golangci-lint run

# Generate mocks (requires mockgen)
mocks:
	go generate ./...

# Database migrations (requires golang-migrate)
migrate-up:
	migrate -path db/migrations -database "postgres://postgres:postgres@localhost:5432/nextpdf?sslmode=disable" up

migrate-down:
	migrate -path db/migrations -database "postgres://postgres:postgres@localhost:5432/nextpdf?sslmode=disable" down

# Create new migration
migrate-create:
	migrate create -ext sql -dir db/migrations -seq $(name)
