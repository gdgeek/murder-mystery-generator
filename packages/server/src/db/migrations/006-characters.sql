-- 006-characters.sql: Create characters table for character persistence and cross-script reuse

CREATE TABLE IF NOT EXISTS characters (
  id             VARCHAR(36)  PRIMARY KEY,
  name           VARCHAR(100) NOT NULL,
  character_type ENUM('player', 'npc') NOT NULL DEFAULT 'player',
  gender         VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '性别',
  birthday       VARCHAR(50)  NULL,
  blood_type     ENUM('A', 'B', 'O', 'AB') NULL COMMENT '血型',
  mbti_type      VARCHAR(4)   NULL COMMENT 'MBTI类型，如 INTJ、ENFP',
  personality    TEXT         NOT NULL,
  abilities      TEXT         NULL,
  appearance     TEXT         NOT NULL COMMENT '外貌描述，用于角色形象图片生成',
  tags           JSON         NULL COMMENT 'JSON数组，角色标签',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_characters_name (name),
  INDEX idx_characters_type (character_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Down (manual rollback reference):
-- DROP TABLE IF EXISTS characters;
