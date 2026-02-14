-- 004-ai-config-meta.sql: Add ai_config_meta column for ephemeral AI config

ALTER TABLE authoring_sessions ADD COLUMN ai_config_meta JSON AFTER script_id;
