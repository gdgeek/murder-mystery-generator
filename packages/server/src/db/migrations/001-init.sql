-- 001-init.sql: Initial schema for the murder mystery script generation system

-- 剧本配置
CREATE TABLE IF NOT EXISTS script_configs (
  id VARCHAR(36) PRIMARY KEY,
  player_count INT NOT NULL,
  duration_hours INT NOT NULL,
  game_type ENUM('honkaku', 'shin_honkaku', 'henkaku') NOT NULL,
  age_group ENUM('elementary', 'middle_school', 'college', 'adult') NOT NULL,
  restoration_ratio INT NOT NULL,
  deduction_ratio INT NOT NULL,
  era VARCHAR(100),
  location VARCHAR(100),
  theme VARCHAR(100),
  language VARCHAR(10) DEFAULT 'zh',
  round_structure JSON NOT NULL,
  special_setting JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 剧本
CREATE TABLE IF NOT EXISTS scripts (
  id VARCHAR(36) PRIMARY KEY,
  config_id VARCHAR(36) NOT NULL,
  version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  parent_version_id VARCHAR(36),
  title VARCHAR(200) NOT NULL,
  content JSON NOT NULL,
  status ENUM('generating', 'ready', 'optimizing') DEFAULT 'generating',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (config_id) REFERENCES script_configs(id)
);

-- 标签
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  category ENUM('game_type', 'age_group', 'player_count', 'era', 'theme', 'custom') NOT NULL,
  UNIQUE KEY unique_tag (name, category)
);

-- 剧本-标签关联
CREATE TABLE IF NOT EXISTS script_tags (
  script_id VARCHAR(36) NOT NULL,
  tag_id VARCHAR(36) NOT NULL,
  is_auto_generated BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (script_id, tag_id),
  FOREIGN KEY (script_id) REFERENCES scripts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
