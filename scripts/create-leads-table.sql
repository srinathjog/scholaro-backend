-- Migration: create leads table
-- Run this against your production database (Supabase SQL editor).
-- Safe to run multiple times — uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  parent_name     VARCHAR(255) NOT NULL,
  parent_phone    VARCHAR(50) NOT NULL,
  parent_email    VARCHAR(255),
  child_name      VARCHAR(255) NOT NULL,
  child_dob       VARCHAR(20),
  expected_class  VARCHAR(100),
  status          VARCHAR(20) NOT NULL DEFAULT 'new',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads (tenant_id);
