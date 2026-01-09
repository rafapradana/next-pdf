-- Migration: Add Workspaces
-- Description: Creates workspaces, workspace_members tables and adds workspace_id to folders/files

-- 1. Create Workspaces Table
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(20) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for invite code lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_invite_code ON workspaces(invite_code);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);

-- 2. Create Workspace Members Table
CREATE TABLE IF NOT EXISTS workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'owner', 'admin', 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- 3. Add workspace_id to Folders
ALTER TABLE folders ADD COLUMN IF NOT EXISTS workspace_id UUID;
-- Foreign key will be added after data migration (nullable for now)

-- 4. Add workspace_id to Files
ALTER TABLE files ADD COLUMN IF NOT EXISTS workspace_id UUID;
-- Foreign key will be added after data migration (nullable for now)

-- 4.5 Add workspace_id to Pending Uploads
ALTER TABLE pending_uploads ADD COLUMN IF NOT EXISTS workspace_id UUID;
-- FK (Nullable)
ALTER TABLE pending_uploads 
    ADD CONSTRAINT fk_pending_uploads_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;

-- 5. Data Migration Function (To be run manually or part of this migration)
-- For existing users, create a personal workspace and move items
DO $$
DECLARE
    u RECORD;
    w_id UUID;
    invite_code TEXT;
BEGIN
    FOR u IN SELECT * FROM users LOOP
        -- Generate random invite code (simplified)
        invite_code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Create Personal Workspace
        INSERT INTO workspaces (name, invite_code, owner_id)
        VALUES (u.full_name || '''s Workspace', invite_code, u.id)
        RETURNING id INTO w_id;
        
        -- Add as Owner Member
        INSERT INTO workspace_members (workspace_id, user_id, role)
        VALUES (w_id, u.id, 'owner');
        
        -- Move Folders
        UPDATE folders SET workspace_id = w_id WHERE user_id = u.id;
        
        -- Move Files
        UPDATE files SET workspace_id = w_id WHERE user_id = u.id;
    END LOOP;
END $$;

-- 6. Add Foreign Key Constraints (Now that data is migrated)
ALTER TABLE folders 
    ADD CONSTRAINT fk_folders_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE files 
    ADD CONSTRAINT fk_files_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

-- 7. Add Indexes
CREATE INDEX IF NOT EXISTS idx_folders_workspace_id ON folders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_files_workspace_id ON files(workspace_id);
