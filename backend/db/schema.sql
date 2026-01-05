-- ============================================================================
-- NEXT PDF - Database Schema
-- PostgreSQL Database Schema (BCNF Normalized, Scalable)
-- Compatible with JWT Access & Refresh Token Authentication
-- ============================================================================

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS TABLE
-- Stores user account information
-- BCNF: All non-key attributes depend only on the primary key (id)
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Index for email lookups (login)
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 2. REFRESH TOKENS TABLE
-- Stores JWT refresh tokens for secure token rotation
-- BCNF: token_hash → all other attributes (token_hash is unique)
-- Supports multiple devices/sessions per user
-- ============================================================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL,  -- SHA-256 hash of the refresh token
    device_info TEXT,                  -- Optional: browser/device identifier
    ip_address INET,                   -- Optional: IP address for security
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,            -- NULL if token is valid
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_refresh_tokens_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT refresh_tokens_hash_unique UNIQUE (token_hash)
);

-- Indexes for token validation and cleanup
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_refresh_tokens_active ON refresh_tokens(user_id, revoked_at) 
    WHERE revoked_at IS NULL;

-- ============================================================================
-- 3. FOLDERS TABLE
-- Stores folder hierarchy with nested structure support
-- BCNF: id → all other attributes
-- Self-referencing for parent-child relationship (tree structure)
-- ============================================================================
CREATE TABLE folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    parent_id UUID,                    -- NULL for root folders
    name VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,                -- Materialized path for efficient tree queries
    depth INTEGER DEFAULT 0,           -- Nesting level (0 = root)
    sort_order INTEGER DEFAULT 0,      -- For custom ordering
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_folders_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_folders_parent 
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT folders_name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
    CONSTRAINT folders_no_self_parent CHECK (id != parent_id),
    -- Unique folder name within same parent for same user
    CONSTRAINT folders_unique_name_per_parent 
        UNIQUE (user_id, parent_id, name)
);

-- Indexes for folder queries
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_folders_parent_id ON folders(parent_id);
CREATE INDEX idx_folders_path ON folders(path text_pattern_ops);  -- For LIKE 'path%' queries
CREATE INDEX idx_folders_user_parent ON folders(user_id, parent_id);

-- ============================================================================
-- 4. SUMMARY STYLE ENUM
-- Defines available summary styles for AI generation
-- ============================================================================
CREATE TYPE summary_style AS ENUM (
    'bullet_points',   -- Concise bullet-point format
    'paragraph',       -- Flowing paragraph narrative
    'detailed',        -- Comprehensive detailed analysis
    'executive',       -- Executive summary (key takeaways)
    'academic'         -- Academic/research style
);

-- ============================================================================
-- 5. PROCESSING STATUS ENUM
-- Defines valid processing states for PDF files
-- ============================================================================
CREATE TYPE processing_status AS ENUM (
    'uploaded',     -- File uploaded, no summary requested yet
    'pending',      -- Summary requested, waiting for processing
    'processing',   -- Currently being processed by AI service
    'completed',    -- Successfully processed
    'failed'        -- Processing failed
);

-- ============================================================================
-- 5. FILES TABLE
-- Stores PDF file metadata
-- BCNF: id → all other attributes
-- Actual PDF files stored in object storage (e.g., S3, MinIO)
-- ============================================================================
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    folder_id UUID,                    -- NULL for files in root
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,        -- Path in object storage
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    file_size BIGINT NOT NULL,         -- Size in bytes
    page_count INTEGER,                -- Number of pages (extracted after upload)
    status processing_status DEFAULT 'uploaded',
    error_message TEXT,                -- Error details if status = 'failed'
    -- Latest summary cache fields (synced from summaries table via trigger)
    latest_summary_title VARCHAR(500),
    latest_summary TEXT,
    latest_summary_style summary_style,
    latest_summary_custom_instruction TEXT,
    latest_summary_model VARCHAR(100),
    latest_summary_duration_ms INTEGER,
    latest_summary_language VARCHAR(10) DEFAULT 'en',
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,          -- When processing completed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_files_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_files_folder 
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT files_size_limit CHECK (file_size > 0 AND file_size <= 26214400),  -- Max 25 MB
    CONSTRAINT files_filename_not_empty CHECK (LENGTH(TRIM(filename)) > 0)
);

-- Indexes for file queries
CREATE INDEX idx_files_user_id ON files(user_id);
CREATE INDEX idx_files_folder_id ON files(folder_id);
CREATE INDEX idx_files_user_folder ON files(user_id, folder_id);
CREATE INDEX idx_files_status ON files(status);
CREATE INDEX idx_files_pending ON files(status) WHERE status = 'pending';
CREATE INDEX idx_files_uploaded ON files(status) WHERE status = 'uploaded';
CREATE INDEX idx_files_uploaded_at ON files(uploaded_at DESC);

-- ============================================================================
-- 7. SUMMARIES TABLE
-- Stores AI-generated summaries for PDF files
-- BCNF: id → all other attributes
-- One-to-One relationship with files (latest summary)
-- Supports summary versioning/regeneration with style and custom instructions
-- ============================================================================
CREATE TABLE summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL,
    title VARCHAR(500),                -- AI-generated title
    content TEXT NOT NULL,             -- Summary content (markdown supported)
    style summary_style NOT NULL DEFAULT 'bullet_points',  -- Selected summary style
    custom_instructions TEXT,          -- User's custom instructions (max 500 chars)
    model_used VARCHAR(100),           -- AI model used (e.g., 'gemini-1.5-pro')
    prompt_tokens INTEGER,             -- Token usage tracking
    completion_tokens INTEGER,
    processing_started_at TIMESTAMPTZ, -- For processing time calculation
    processing_completed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,    -- Duration in milliseconds
    language VARCHAR(10) DEFAULT 'en', -- Summary language (en/id)
    version INTEGER DEFAULT 1,         -- Summary version (for regeneration)
    is_current BOOLEAN DEFAULT TRUE,   -- Flag for current/latest summary
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_summaries_file 
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    
    -- Constraints
    CONSTRAINT summaries_custom_instructions_length 
        CHECK (custom_instructions IS NULL OR LENGTH(custom_instructions) <= 500)
);

-- Indexes for summary queries
CREATE INDEX idx_summaries_file_id ON summaries(file_id);
CREATE INDEX idx_summaries_current ON summaries(file_id, is_current) 
    WHERE is_current = TRUE;
CREATE INDEX idx_summaries_version ON summaries(file_id, version DESC);
CREATE INDEX idx_summaries_style ON summaries(style);

-- Partial unique index: only one current summary per file
CREATE UNIQUE INDEX idx_summaries_unique_current 
    ON summaries(file_id) WHERE is_current = TRUE;

-- ============================================================================
-- 8. PROCESSING JOBS TABLE (Optional - for job queue tracking)
-- Tracks AI processing jobs for monitoring and retry logic
-- BCNF: id → all other attributes
-- ============================================================================
CREATE TYPE job_status AS ENUM (
    'queued',
    'processing',
    'completed',
    'failed',
    'retrying'
);

CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL,
    job_type VARCHAR(50) DEFAULT 'summarize',
    status job_status DEFAULT 'queued',
    priority INTEGER DEFAULT 0,        -- Higher = more priority
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    worker_id VARCHAR(100),            -- ID of worker processing this job
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_processing_jobs_file 
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- Indexes for job queue
CREATE INDEX idx_processing_jobs_file_id ON processing_jobs(file_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_queue ON processing_jobs(status, priority DESC, scheduled_at ASC)
    WHERE status IN ('queued', 'retrying');
CREATE INDEX idx_processing_jobs_worker ON processing_jobs(worker_id) 
    WHERE status = 'processing';

-- ============================================================================
-- 9. USER SESSIONS TABLE (Optional - for session tracking)
-- Tracks active user sessions for analytics and security
-- BCNF: id → all other attributes
-- ============================================================================
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    refresh_token_id UUID,
    ip_address INET,
    user_agent TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_user_sessions_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_sessions_refresh_token 
        FOREIGN KEY (refresh_token_id) REFERENCES refresh_tokens(id) ON DELETE SET NULL
);

-- Indexes for session queries
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_last_active ON user_sessions(last_active_at DESC);

-- ============================================================================
-- 10. AUDIT LOG TABLE (Optional - for security and debugging)
-- Tracks important user actions
-- BCNF: id → all other attributes
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),           -- 'file', 'folder', 'user', etc.
    entity_id UUID,
    details JSONB,                     -- Additional action details
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- 11. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_processing_jobs_updated_at
    BEFORE UPDATE ON processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate folder path (materialized path pattern)
CREATE OR REPLACE FUNCTION calculate_folder_path()
RETURNS TRIGGER AS $$
DECLARE
    parent_path TEXT;
BEGIN
    IF NEW.parent_id IS NULL THEN
        NEW.path = '/' || NEW.id::TEXT;
        NEW.depth = 0;
    ELSE
        SELECT path, depth + 1 INTO parent_path, NEW.depth
        FROM folders WHERE id = NEW.parent_id;
        NEW.path = parent_path || '/' || NEW.id::TEXT;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_folders_path
    BEFORE INSERT OR UPDATE OF parent_id ON folders
    FOR EACH ROW
    EXECUTE FUNCTION calculate_folder_path();

-- Function to mark previous summaries as not current when new one is added
CREATE OR REPLACE FUNCTION handle_new_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Mark all previous summaries for this file as not current
    UPDATE summaries 
    SET is_current = FALSE 
    WHERE file_id = NEW.file_id 
      AND id != NEW.id 
      AND is_current = TRUE;
    
    -- Calculate version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO NEW.version
    FROM summaries WHERE file_id = NEW.file_id;
    
    -- Calculate processing duration if both timestamps exist
    IF NEW.processing_started_at IS NOT NULL AND NEW.processing_completed_at IS NOT NULL THEN
        NEW.processing_duration_ms = EXTRACT(EPOCH FROM (NEW.processing_completed_at - NEW.processing_started_at)) * 1000;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_summaries_new
    BEFORE INSERT ON summaries
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_summary();

-- Trigger function to sync latest summary to files table
CREATE OR REPLACE FUNCTION sync_summary_to_file()
RETURNS TRIGGER AS $$
BEGIN
    -- Only sync if this is the current summary
    IF NEW.is_current = TRUE THEN
        UPDATE files
        SET
            latest_summary_title = NEW.title,
            latest_summary = NEW.content,
            latest_summary_style = NEW.style,
            latest_summary_custom_instruction = NEW.custom_instructions,
            latest_summary_model = NEW.model_used,
            latest_summary_duration_ms = NEW.processing_duration_ms,
            latest_summary_language = COALESCE(NEW.language, 'en'),
            updated_at = NOW()
        WHERE id = NEW.file_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_summary_to_file
    AFTER INSERT ON summaries
    FOR EACH ROW
    EXECUTE FUNCTION sync_summary_to_file();

-- ============================================================================
-- 12. HELPER VIEWS
-- ============================================================================

-- View: Get folder tree with file counts
CREATE OR REPLACE VIEW folder_tree_view AS
SELECT 
    f.id,
    f.user_id,
    f.parent_id,
    f.name,
    f.path,
    f.depth,
    f.sort_order,
    f.created_at,
    f.updated_at,
    COUNT(DISTINCT files.id) AS file_count,
    COALESCE(SUM(files.file_size), 0) AS total_size
FROM folders f
LEFT JOIN files ON files.folder_id = f.id
GROUP BY f.id, f.user_id, f.parent_id, f.name, f.path, f.depth, f.sort_order, f.created_at, f.updated_at;

-- View: Files with their current summary status
CREATE OR REPLACE VIEW files_with_summary_view AS
SELECT 
    f.id,
    f.user_id,
    f.folder_id,
    f.filename,
    f.original_filename,
    f.file_size,
    f.page_count,
    f.status,
    f.uploaded_at,
    s.id AS summary_id,
    s.title AS summary_title,
    s.style AS summary_style,
    s.processing_duration_ms,
    s.version AS summary_version,
    CASE WHEN s.id IS NOT NULL THEN TRUE ELSE FALSE END AS has_summary
FROM files f
LEFT JOIN summaries s ON s.file_id = f.id AND s.is_current = TRUE;

-- ============================================================================
-- 13. INITIAL SEED DATA (Optional)
-- ============================================================================

-- You can add initial seed data here if needed
-- Example: Admin user, default folders, etc.

-- ============================================================================
-- 14. CLEANUP FUNCTIONS
-- ============================================================================

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens 
    WHERE expires_at < NOW() OR revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old audit logs (older than 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 15. PENDING UPLOADS TABLE
-- Stores temporary upload sessions for presigned URL flow
-- ============================================================================
CREATE TABLE pending_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    folder_id UUID,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    storage_path TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Foreign Keys
    CONSTRAINT fk_pending_uploads_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pending_uploads_folder 
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
);

-- Indexes for pending uploads
CREATE INDEX idx_pending_uploads_user ON pending_uploads(user_id);
CREATE INDEX idx_pending_uploads_expires ON pending_uploads(expires_at);