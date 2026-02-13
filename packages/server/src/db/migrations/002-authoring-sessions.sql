-- 002-authoring-sessions.sql: Schema for staged authoring workflow

-- 创作会话
CREATE TABLE IF NOT EXISTS authoring_sessions (
  id VARCHAR(36) PRIMARY KEY,
  config_id VARCHAR(36) NOT NULL,
  mode ENUM('staged', 'vibe') NOT NULL,
  state ENUM(
    'draft', 'planning', 'plan_review',
    'designing', 'design_review',
    'executing', 'chapter_review',
    'completed', 'generating', 'failed'
  ) NOT NULL DEFAULT 'draft',
  plan_output JSON,
  outline_output JSON,
  chapters JSON,
  chapter_edits JSON,
  current_chapter_index INT DEFAULT 0,
  total_chapters INT DEFAULT 0,
  script_id VARCHAR(36),
  failure_info JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (config_id) REFERENCES script_configs(id),
  FOREIGN KEY (script_id) REFERENCES scripts(id)
);

CREATE INDEX idx_sessions_config ON authoring_sessions(config_id);
CREATE INDEX idx_sessions_state ON authoring_sessions(state);
