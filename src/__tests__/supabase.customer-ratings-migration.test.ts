import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readMigration = (name: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", name), "utf8");

const release = readMigration("20260914000000_customer_ratings_release.sql");

describe("customer ratings release migration (20260914000000)", () => {
  const surface = [
    "public_client_portal_rate_visit_v1(UUID, UUID, UUID, TEXT, TEXT, SMALLINT, TEXT)",
    "public_invoice_rating_lookup_v1(UUID)",
    "public_invoice_rate_visit_v1(UUID, SMALLINT, TEXT)",
  ];

  it("creates the three rating RPCs", () => {
    for (const fn of ["public_client_portal_rate_visit_v1", "public_invoice_rating_lookup_v1", "public_invoice_rate_visit_v1"]) {
      expect(release).toContain(`CREATE OR REPLACE FUNCTION public.${fn}(`);
    }
  });

  it("grants exactly the rating surface to anon + authenticated, never PUBLIC", () => {
    for (const signature of surface) {
      expect(release).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO anon, authenticated`);
      expect(release).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC`);
    }
  });

  it("keeps anon off every table and sequence (defense in depth)", () => {
    expect(release).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon");
    expect(release).toContain("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon");
  });

  it("portal rating authenticates like cancel/reschedule and validates the rating", () => {
    expect(release).toContain("portal_access_token = NULLIF(btrim(COALESCE(p_token, '')), '')");
    expect(release).toContain("portal_access_enabled = TRUE");
    expect(release).toContain("RAISE EXCEPTION 'invalid_portal_credentials' USING ERRCODE = '22023'");
    expect(release).toContain("p_rating NOT BETWEEN 1 AND 5");
    // The write path re-checks appointment ownership (customer + center).
    expect(release).toContain("AND customer_id = v_customer.id");
  });

  it("receipt rating is bounded: rating range, 500-char comment, unknown invoices rejected", () => {
    expect(release).toContain("left(NULLIF(btrim(COALESCE(p_comment, '')), ''), 500)");
    expect(release).toContain("RAISE EXCEPTION 'invoice_not_found' USING ERRCODE = '22023'");
  });

  it("one rating per appointment via the pre-existing partial unique index", () => {
    expect(release).toContain("ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL");
  });

  it("walk-in invoices update the customer's newest general review in place (no row multiplication)", () => {
    expect(release).toContain("AND appointment_id IS NULL");
    expect(release).toContain("ORDER BY created_at DESC");
    // The general-review upsert must NOT create a new uniqueness constraint
    // that could fail on salons with historical general reviews.
    expect(release).not.toContain("CREATE UNIQUE INDEX");
  });

  it("matches the lookup's general-review lookup with IS NOT DISTINCT FROM", () => {
    expect(release).toContain("r.appointment_id IS NOT DISTINCT FROM v_invoice.appointment_id");
  });

  it("runs as a single transaction and is wired to the pages that call it", () => {
    expect(release).toContain("BEGIN;");
    expect(release).toContain("COMMIT;");
    const routes = readFileSync(resolve(process.cwd(), "src/routes.tsx"), "utf8");
    expect(routes).toContain('path="/rate"');
    const adapter = readFileSync(resolve(process.cwd(), "src/infrastructure/supabase/repositories/publicAccess.ts"), "utf8");
    for (const rpc of [
      "public_client_portal_rate_visit_v1",
      "public_invoice_rating_lookup_v1",
      "public_invoice_rate_visit_v1",
    ]) {
      expect(adapter).toContain(rpc);
    }
    // The receipt QR points at the rating page (no more dead JSON blob).
    const layout = readFileSync(resolve(process.cwd(), "src/shared/components/InvoicePrintLayout.tsx"), "utf8");
    expect(layout).toContain('/#/rate?invoice=');
  });
});
