-- Inhalte und Bearbeitungsstand der Redaktion.
CREATE TABLE IF NOT EXISTS cms_content (
  id         TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  revision   INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'system'
);
