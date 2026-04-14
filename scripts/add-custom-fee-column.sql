-- Add custom_fee_amount column to enrollments table
-- This allows per-student fee overrides (e.g., principal-set custom monthly fee)
-- NULL means "use default class fee structure"

ALTER TABLE enrollments
ADD COLUMN IF NOT EXISTS custom_fee_amount DECIMAL(10, 2) DEFAULT NULL;
