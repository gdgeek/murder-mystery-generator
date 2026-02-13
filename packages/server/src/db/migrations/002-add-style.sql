-- 002-add-style.sql: Add style column to script_configs
ALTER TABLE script_configs
  ADD COLUMN style VARCHAR(20) DEFAULT 'detective' AFTER language;
