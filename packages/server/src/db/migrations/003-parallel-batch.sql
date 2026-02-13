-- 003-parallel-batch.sql: Add parallel_batch column for parallel chapter generation

ALTER TABLE authoring_sessions ADD COLUMN parallel_batch JSON AFTER total_chapters;
