-- Prevent duplicate season names regardless of status or date range.
CREATE UNIQUE INDEX IF NOT EXISTS "seasons_name_lower_unique" ON "seasons" (lower("name"));
