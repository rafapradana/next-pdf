# NEXT PDF

AI-powered Document Management & PDF Intelligence Platform.

## Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose
- (Optional) Gemini API Key for AI summarization

### Run with Docker Compose

```bash
# Clone and navigate to project
cd next-pdf

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api/v1
- **AI Service**: http://localhost:8000
- **MinIO Console**: http://localhost:9001 (admin: minioadmin/minioadmin)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                    (Next.js - :3000)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────────┐
│                        Backend                               │
│                    (Go/Fiber - :8080)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │PostgreSQL│   │  MinIO   │   │AI Service│
    │  (:5432) │   │ (:9000)  │   │ (:8000)  │
    └──────────┘   └──────────┘   └──────────┘
```

## Project Structure

```
next-pdf/
├── frontend/          # Next.js frontend
│   ├── app/           # App router pages
│   ├── components/    # React components
│   └── lib/           # API client & contexts
├── backend/           # Go backend API
│   ├── cmd/           # Entry point
│   └── internal/      # Core logic
├── ai/                # Python AI service
│   ├── services/      # PDF & summarization
│   └── main.py        # FastAPI app
└── docs/              # Documentation
```

## Development Setup

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

### Backend (Go)
```bash
cd backend
go mod download
go run cmd/api/main.go
```

### AI Service (Python)
```bash
cd ai
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

## Environment Variables

### Root (.env)
```env
JWT_ACCESS_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-api-key
```

### Backend (backend/.env)
See `backend/.env.example`

### AI Service (ai/.env)
See `ai/.env.example`

## API Documentation

### Backend Endpoints
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/folders/tree` - Get folder tree
- `POST /api/v1/files/upload/presign` - Get upload URL
- `POST /api/v1/summaries/{file_id}/generate` - Generate summary

### AI Service Endpoints
- `GET /health` - Health check
- `GET /styles` - Get summary styles
- `POST /summarize` - Queue PDF summarization