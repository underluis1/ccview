import type Database from 'better-sqlite3'

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_path TEXT,
  project_name TEXT,
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  duration_seconds INTEGER,
  total_tokens_in INTEGER DEFAULT 0,
  total_tokens_out INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  tool_call_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  model TEXT,
  summary TEXT,
  raw_log_path TEXT,
  log_hash TEXT,
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(raw_log_path)
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_name);
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT,
  content TEXT,
  content_summary TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  duration_ms INTEGER,
  tool_name TEXT,
  tool_input TEXT,
  tool_output TEXT,
  is_error INTEGER DEFAULT 0,
  is_retry INTEGER DEFAULT 0,
  retry_of_step_id TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (retry_of_step_id) REFERENCES steps(id)
);

CREATE INDEX IF NOT EXISTS idx_steps_session ON steps(session_id, step_index);
CREATE INDEX IF NOT EXISTS idx_steps_type ON steps(type);

CREATE TABLE IF NOT EXISTS file_impacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  action TEXT NOT NULL,
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,
  diff_content TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_file_impacts_session ON file_impacts(session_id);
CREATE INDEX IF NOT EXISTS idx_file_impacts_file ON file_impacts(file_path);

CREATE TABLE IF NOT EXISTS projects (
  path TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_sessions INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  first_session_at DATETIME,
  last_session_at DATETIME,
  claude_md_path TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS claude_md_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  rule_category TEXT,
  times_respected INTEGER DEFAULT 0,
  times_violated INTEGER DEFAULT 0,
  last_checked_at DATETIME,
  FOREIGN KEY (project_path) REFERENCES projects(path)
);

CREATE VIEW IF NOT EXISTS v_session_overview AS
SELECT
  s.*,
  p.name as project_display_name,
  COUNT(DISTINCT fi.file_path) as unique_files_touched,
  SUM(CASE WHEN st.is_error THEN 1 ELSE 0 END) as errors,
  SUM(CASE WHEN st.subtype = 'bash' THEN 1 ELSE 0 END) as bash_commands,
  SUM(CASE WHEN st.subtype = 'file_edit' THEN 1 ELSE 0 END) as file_edits
FROM sessions s
LEFT JOIN projects p ON s.project_path = p.path
LEFT JOIN steps st ON s.id = st.session_id
LEFT JOIN file_impacts fi ON s.id = fi.session_id
GROUP BY s.id;

CREATE VIEW IF NOT EXISTS v_file_hotspots AS
SELECT
  fi.file_path,
  s.project_name,
  COUNT(*) as total_touches,
  SUM(fi.lines_added) as total_lines_added,
  SUM(fi.lines_removed) as total_lines_removed,
  COUNT(DISTINCT fi.session_id) as sessions_involved
FROM file_impacts fi
JOIN sessions s ON fi.session_id = s.id
WHERE fi.action IN ('create', 'edit', 'delete')
GROUP BY fi.file_path, s.project_name
ORDER BY total_touches DESC;

CREATE VIEW IF NOT EXISTS v_daily_costs AS
SELECT
  DATE(started_at) as day,
  COUNT(*) as sessions,
  SUM(total_tokens_in + total_tokens_out) as total_tokens,
  SUM(total_cost_usd) as total_cost,
  AVG(duration_seconds) as avg_session_duration
FROM sessions
GROUP BY DATE(started_at)
ORDER BY day DESC;
`

const INITIAL_VERSION = 1

export function initSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL)

  const hasVersion = db
    .prepare<[number], { version: number }>(
      `SELECT version FROM _migrations WHERE version = ?`
    )
    .get(INITIAL_VERSION)

  if (!hasVersion) {
    db.prepare(
      `INSERT INTO _migrations (version, name) VALUES (?, ?)`
    ).run(INITIAL_VERSION, 'initial_schema')
  }
}
