-- Performance indexes for frequently queried tables
-- Run once against the production database

-- Activity feed: filter by tenant + class, sort by created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_tenant_class_created
  ON activities (tenant_id, class_id, created_at DESC);

-- Activity media: FK lookup by activity_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_media_activity_id
  ON activity_media (activity_id);

-- Daily logs: filter by tenant + enrollment + date range
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_logs_tenant_enrollment_created
  ON daily_logs (tenant_id, enrollment_id, created_at);

-- Fees: filter by tenant + enrollment
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fees_tenant_enrollment
  ON fees (tenant_id, enrollment_id);

-- Parent-student links: lookup by parent + tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_parent_students_parent_tenant
  ON parent_students (parent_user_id, tenant_id);

-- Enrollments: lookup by student + tenant + status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enrollments_student_tenant_status
  ON enrollments (student_id, tenant_id, status);

-- Attendance: lookup by student + date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_student_date
  ON attendance (student_id, date);
