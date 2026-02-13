-- 004-ai-config-meta.sql: Add ai_config_meta column for ephemeral AI config metadata

ALTER TABLE authoring_sessions ADD COLUMN ai_config_meta JSON DEFAULT NULL;
