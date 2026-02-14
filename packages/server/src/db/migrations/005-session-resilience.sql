-- 005-session-resilience.sql: Add last_step_tokens column for per-step token usage tracking

ALTER TABLE authoring_sessions ADD COLUMN last_step_tokens JSON DEFAULT NULL AFTER ai_config_meta;
