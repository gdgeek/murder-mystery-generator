-- 007-script-character-sets.sql: Create script_character_sets table linking characters to scripts

CREATE TABLE IF NOT EXISTS script_character_sets (
  id                  VARCHAR(36)  PRIMARY KEY,
  character_id        VARCHAR(36)  NOT NULL,
  script_id           VARCHAR(36)  NOT NULL,
  character_type      ENUM('player', 'npc') NOT NULL DEFAULT 'player' COMMENT '角色在此剧本中的类型',
  motivation          TEXT         NULL COMMENT '角色在此剧本中的动机',
  experience_summary  TEXT         NULL COMMENT '经历概述',
  narrative_role      VARCHAR(50)  NULL COMMENT '叙事功能定位',
  secrets             JSON         NULL COMMENT '角色在此剧本中的秘密列表',
  created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (character_id) REFERENCES characters(id),
  INDEX idx_scs_character (character_id),
  INDEX idx_scs_script (script_id),
  UNIQUE INDEX idx_scs_char_script (character_id, script_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Down (manual rollback reference):
-- DROP TABLE IF EXISTS script_character_sets;
