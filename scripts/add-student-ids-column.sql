-- Migration: add student_ids (jsonb) to activities table
-- Run once against the production database.
-- Backward-compatible: keeps the existing student_id UUID column untouched.
-- New posts will use student_ids; existing single-student posts are migrated below.

-- 1. Add the new column (nullable, defaults to NULL = class-wide post)
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS student_ids jsonb DEFAULT NULL;

-- 2. Back-fill existing single-student posts so they are still visible to parents
UPDATE activities
   SET student_ids = jsonb_build_array(student_id)
 WHERE student_id IS NOT NULL
   AND student_ids IS NULL;
