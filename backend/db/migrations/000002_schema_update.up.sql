-- Add page_count to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS page_count INTEGER;

-- Ensure summaries table has is_current column
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE;

-- Ensure/Recreate unique index for current summary
DROP INDEX IF EXISTS unique_current_summary;
CREATE UNIQUE INDEX unique_current_summary ON summaries (file_id) WHERE is_current = true;
