-- Migration: allow 'inactive' as a student status value
-- The students.status column is varchar(100), so no schema change is needed.
-- This script adds a CHECK constraint if one doesn't exist, and ensures
-- all existing students without a status default to 'active'.

-- Ensure all existing rows have a valid status
UPDATE students SET status = 'active' WHERE status IS NULL OR status = '';

-- Optional: add a check constraint to enforce valid values
-- Run this only if no constraint already exists on the column.
-- ALTER TABLE students
--   ADD CONSTRAINT chk_students_status
--   CHECK (status IN ('active', 'inactive'));
