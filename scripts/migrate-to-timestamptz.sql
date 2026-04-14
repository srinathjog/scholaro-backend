-- Migration: Convert all timestamp columns to timestamptz
-- This ensures times are stored with timezone awareness (UTC)
-- and correctly interpreted across different client timezones.
-- Safe to run: ALTER TYPE on timestamp → timestamptz preserves existing data
-- (PostgreSQL treats existing values as UTC when no timezone was stored).

-- attendance
ALTER TABLE attendance ALTER COLUMN check_in_time TYPE timestamptz USING check_in_time AT TIME ZONE 'UTC';
ALTER TABLE attendance ALTER COLUMN check_out_time TYPE timestamptz USING check_out_time AT TIME ZONE 'UTC';
ALTER TABLE attendance ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- classes
ALTER TABLE classes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- sections
ALTER TABLE sections ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- daily_logs
ALTER TABLE daily_logs ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- fee_structures
ALTER TABLE fee_structures ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- fees
ALTER TABLE fees ALTER COLUMN last_reminder_sent TYPE timestamptz USING last_reminder_sent AT TIME ZONE 'UTC';
ALTER TABLE fees ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE fees ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- academic_years
ALTER TABLE academic_years ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- parent_students
ALTER TABLE parent_students ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- push_subscriptions
ALTER TABLE push_subscriptions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- enrollments
ALTER TABLE enrollments ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- teachers
ALTER TABLE teachers ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- teacher_assignments
ALTER TABLE teacher_assignments ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- tenant_settings
ALTER TABLE tenant_settings ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- tenants
ALTER TABLE tenants ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE tenants ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
