import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('customer experience + forecasting + accounting + advanced migration', () => {
  const sql = fs.readFileSync('supabase/migrations/20260628000012_customer_experience_forecasting_accounting_advanced.sql', 'utf8');

  it('creates customer review and service file structures', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.customer_reviews');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.service_files');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.service_file_images');
  });

  it('adds security definer RPCs with membership checks', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain('app_private.is_center_member');
    expect(sql).toContain('create_customer_review_v1');
    expect(sql).toContain('create_accounting_journal_entry_v1');
    expect(sql).toContain('create_ai_booking_lead_v1');
  });

  it('extends portal profile to v2 with experience data', () => {
    expect(sql).toContain('public_client_portal_profile_v2');
    expect(sql).toContain("'reviews'");
    expect(sql).toContain("'service_files'");
    expect(sql).toContain("'notification_timeline'");
    expect(sql).toContain("'referral'");
  });
});
