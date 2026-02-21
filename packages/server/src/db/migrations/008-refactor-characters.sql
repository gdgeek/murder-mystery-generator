-- 008-refactor-characters.sql: Refactor characters table for reusable character library
-- Characters table stores GENERIC character traits (not script-specific)
-- Script-specific data (type, motivation, secrets, backstory) goes to script_character_sets

-- 1. Remove character_type and birthday from characters, add zodiac_sign
ALTER TABLE characters
  DROP INDEX idx_characters_type,
  DROP COLUMN character_type,
  DROP COLUMN birthday,
  ADD COLUMN zodiac_sign VARCHAR(20) NULL COMMENT '星座' AFTER gender;

-- 2. Add script-specific fields to script_character_sets
ALTER TABLE script_character_sets
  ADD COLUMN background_story TEXT NULL COMMENT '角色在此剧本中的背景故事' AFTER character_type,
  ADD COLUMN primary_motivation TEXT NULL COMMENT '角色在此剧本中的核心动机' AFTER background_story,
  ADD COLUMN relationships JSON NULL COMMENT '角色在此剧本中的关系网络' AFTER secrets;

-- Down (manual rollback reference):
-- ALTER TABLE characters ADD COLUMN character_type ENUM('player','npc') NOT NULL DEFAULT 'player' AFTER name, ADD COLUMN birthday VARCHAR(50) NULL AFTER gender, DROP COLUMN zodiac_sign, ADD INDEX idx_characters_type (character_type);
-- ALTER TABLE script_character_sets DROP COLUMN background_story, DROP COLUMN primary_motivation, DROP COLUMN relationships;
