# NEXT PDF

**AI-Powered Document Management & Intelligence Platform**

Next PDF is a modern, full-stack application designed to manage, organize, and analyze PDF documents using advanced AI. It features a robust workspace system for team collaboration, nested folder structures, and powerful AI summarization capabilities using Google's Gemini models.

## Key Features

### Smart Document Management
- **Nested Folders**: Organize files in a hierarchical tree structure with unlimited depth.
- **Drag & Drop**: Intuitive UI for moving files and folders (powered by `dnd-kit`).
- **High Performance**: Optimized for handling large file lists and deep hierarchies.
- **S3-Compatible Storage**: Secure file storage using MinIO (AWS S3 compatible).

### AI Intelligence
- **PDF Summarization**: Automatically generate concise summaries of uploaded documents using Google Gemini.
- **Multiple Styles**: Choose from various summary styles (Bullet Points, Paragraph, Executive, Academic).
- **Versioning**: Maintain and switch between different versions of summaries for the same file.
- **Custom Instructions**: Provide specific prompts to tailor the AI's output.

### Workspaces & Collaboration
- **Multi-Workspace Support**: Users can create and manage multiple workspaces.
- **Team Collaboration**: Invite members to workspaces via invite codes.
- **Role-Based Access**: Granular permissions for Workspace Owners and Members.
- **Shared Visibility**: Members can view and collaborate on files within shared workspaces.

### Data Export
- **Flexible Export**: Export file metadata and summaries.
- **Multiple Formats**: Support for **CSV** (spreadsheet ready) and **JSON** (programmatic use / backup).
- **Filtering**: Export specific folders, search results, or selected files.

### Security
- **JWT Authentication**: Secure access with short-lived access tokens and rotating refresh tokens.
- **Presigned URLs**: Secure file uploads directly to object storage, bypassing the backend server for performance.

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4, shadcn/ui
- **State Management**: React Context + Hooks
- **Icons**: Lucide React
- **Utils**: `sonner` (toasts), `dnd-kit` (drag & drop)

### Backend
- **Language**: Go (Golang) 1.22
- **Framework**: Fiber v2 (Fast HTTP engine)
- **Database**: PostgreSQL (pgx driver)
- **Wait Storage**: MinIO (S3 Compatible)
- **Auth**: JWT (RS256/HS256)

### AI Service
- **Language**: Python 3.10+
- **Framework**: FastAPI
- **PDF Processing**: `pymupdf` (Fitz), `pypdf`
- **AI Model**: Google Generative AI (Gemini)

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 16
- **Object Storage**: MinIO

---

## Architecture

```mermaid
graph TD
    Client[Frontend (Next.js)]
    LB[Load Balancer / Nginx]
    BE[Backend API (Go/Fiber)]
    AI[AI Service (Python/FastAPI)]
    DB[(PostgreSQL)]
    S3[(MinIO Storage)]
    Gemini[Google Gemini API]

    Client -->|HTTP/REST| BE
    Client -->|Upload/Download| S3
    BE -->|Query/Transact| DB
    BE -->|Presigned URLs| S3
    BE -->|Summarize Request| AI
    AI -->|Fetch PDF| S3
    AI -->|Generate| Gemini
```

---

## Quick Start (Docker)

The easiest way to run the application is using Docker Compose.

### Prerequisites
- Docker & Docker Compose installed.
- A Google Cloud API Key for Gemini.

### 1. Configure Environment
Create a `.env` file in the root directory:

```env
# Root .env
JWT_ACCESS_SECRET=your_super_secret_access_key
JWT_REFRESH_SECRET=your_super_secret_refresh_key
GEMINI_API_KEY=your_google_gemini_api_key
```

### 2. Start Services
```bash
docker-compose up -d --build
```

### 3. Access the App
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:8080](http://localhost:8080)
- **AI Service Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (User: `minioadmin`, Pass: `minioadmin`)

---

## Manual Development Setup

If you prefer running services individually for development:

### 1. Infrastructure (DB & MinIO)
Run only the supporting services via Docker:
```bash
docker-compose up -d db minio createbuckets
```

### 2. Backend (Go)
```bash
cd backend
cp .env.example .env
# Edit .env to match your local DB/MinIO config
make run
# App running at :8080
```

### 3. AI Service (Python)
```bash
cd ai
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env 
# Add your GEMINI_API_KEY to .env
uvicorn main:app --reload --port 8000
```

### 4. Frontend (Next.js)
```bash
cd frontend
# Create .env.local if needed, usually defaults work for localhost
npm install
npm run dev
# App running at :3000
```

---

## 🔧 Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Default (Local) |
|----------|-------------|-----------------|
| `DB_HOST` | Database Host | `localhost` |
| `DB_PORT` | Database Port | `5432` |
| `DB_USER` | Database User | `postgres` |
| `DB_PASSWORD` | Database Password | `postgres` |
| `DB_NAME` | Database Name | `nextpdf` |
| `MINIO_ENDPOINT` | MinIO URL | `localhost:9000` |
| `MINIO_ACCESS_KEY` | Access Key | `minioadmin` |
| `MINIO_SECRET_KEY` | Secret Key | `minioadmin` |
| `JWT_ACCESS_SECRET`| JWT Signing Key | (Set in production) |

### AI Service (`ai/.env`)
| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | **Required**. Google AI API Key. |
| `MINIO_ENDPOINT` | MinIO URL for fetching PDFs. |

---

## API Documentation

### Key Endpoints

#### Auth
- `POST /auth/register`: Create new account.
- `POST /auth/login`: Get access/refresh tokens.
- `POST /auth/refresh`: Rotate tokens.

#### Files & Folders
- `GET /folders/tree`: Get hierarchical folder structure.
- `POST /files/upload/presign`: Generate URL for direct S3 upload.
- `GET /files`: List files (supports filtering/sorting).
- `GET /files/export`: Export data (Format: `csv` or `json`).

#### AI
- `POST /summaries/{id}/generate`: Trigger summarization.
- `GET /summaries/{id}`: Get latest summary.

---

## Troubleshooting

### Database Migration Errors
If you see errors like `relation "pending_uploads" does not exist` when first running:
- Ensure the database is clean or run `make migrate-up` in the backend folder.
- The `schema.sql` is idempotent and safe to run on existing DBs.

### CORS Errors
- Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL (default `http://localhost:3000`).

---