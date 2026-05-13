-- Creates the class_planners table (safe: no-op if already exists)
CREATE TABLE IF NOT EXISTS class_planners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  class_id     UUID NOT NULL,
  section_id   UUID,
  file_url     TEXT NOT NULL,
  file_type    VARCHAR(20) NOT NULL,
  month        VARCHAR(20) NOT NULL,
  year         INT NOT NULL,
  uploaded_by  UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_class_planners_tenant_id    ON class_planners (tenant_id);
CREATE INDEX IF NOT EXISTS idx_class_planners_class_month  ON class_planners (tenant_id, class_id, month, year);
