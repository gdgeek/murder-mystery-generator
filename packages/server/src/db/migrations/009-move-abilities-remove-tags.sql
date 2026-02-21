-- 009-move-abilities-remove-tags.sql: Remove tags from characters, move abilities to script_character_sets

-- 1. Add abilities column to script_character_sets
ALTER TABLE script_character_sets
  ADD COLUMN abilities TEXT NULL COMMENT '角色在此剧本中的能力/特质' AFTER character_type;

-- 2. Migrate existing abilities data from characters to script_character_sets
UPDATE script_character_sets scs
  JOIN characters c ON scs.character_id = c.id
  SET scs.abilities = c.abilities
  WHERE c.abilities IS NOT NULL AND c.abilities != '';

-- 3. Remove abilities and tags from characters
ALTER TABLE characters
  DROP COLUMN abilities,
  DROP COLUMN tags;

-- Down (manual rollback reference):
-- ALTER TABLE characters ADD COLUMN abilities TEXT NULL AFTER mbti_type, ADD COLUMN tags JSON NULL COMMENT 'JSON数组，角色标签';
-- UPDATE characters c JOIN script_character_sets scs ON c.id = scs.character_id SET c.abilities = scs.abilities;
-- ALTER TABLE script_character_sets DROP COLUMN abilities;
