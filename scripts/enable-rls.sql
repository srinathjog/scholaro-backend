-- ============================================================
-- Scholaro: Row-Level Security (RLS) for Tenant Isolation
-- ============================================================
-- IMPORTANT: Deploy the RLS interceptor in the backend FIRST
-- (src/rls.interceptor.ts) before running this script.
-- Without it, all queries will return 0 rows because
-- app.current_tenant won't be set.
--
-- Run against your Railway PostgreSQL (not Supabase).
-- Test in development before applying to production.
-- ============================================================

-- 1. students
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE students FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON students
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 2. users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 3. user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_roles
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 4. teachers
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON teachers
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 5. classes
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON classes
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 6. sections
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sections
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 7. enrollments
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON enrollments
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 8. activities
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON activities
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 9. activity_media
ALTER TABLE activity_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_media FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON activity_media
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 10. fees
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fees
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 11. fee_structures
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_structures FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON fee_structures
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 12. attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON attendance
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 13. daily_logs
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON daily_logs
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 14. messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 15. parent_students
ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_students FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON parent_students
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 16. teacher_assignments
ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON teacher_assignments
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 17. academic_years
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON academic_years
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 18. tenant_settings
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_settings
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 19. push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON push_subscriptions
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ============================================================
-- NOT protected by RLS (intentionally global):
--   - tenants  (multi-tenant registry)
--   - roles    (shared role definitions)
-- ============================================================
