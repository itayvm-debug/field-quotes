-- ================================================================
-- Field Quotes — Migration 002 — Seed Company Settings
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================================

UPDATE company_settings
SET
  company_name          = 'חברת נתן ולדמן ובניו בע"מ',
  company_id_number     = '51166474',
  address               = 'אילת',
  phone                 = '08-6378089',
  email                 = 'valdmann@012.net.il',
  default_payment_terms = 'שוטף + 30',
  default_exclusions    = '',
  footer_text           = 'חברת נתן ולדמן ובניו בע"מ | ח.פ 51166474 | 08-6378089'
WHERE singleton_key = 1;

-- ================================================================
-- END OF MIGRATION 002
-- ================================================================
