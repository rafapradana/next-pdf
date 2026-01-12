-- Revert changes
DROP INDEX IF EXISTS unique_current_summary;
ALTER TABLE summaries DROP COLUMN IF EXISTS is_current;
ALTER TABLE files DROP COLUMN IF EXISTS page_count;
