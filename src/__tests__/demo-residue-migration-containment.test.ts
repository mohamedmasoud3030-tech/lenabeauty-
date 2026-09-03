import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260903001710_demo_financial_residue_repair_20260903.sql"),
  "utf8",
);

describe("Demo financial residue migration containment", () => {
  it("is a no-op when the exact known Demo residue is absent", () => {
    expect(migration).toContain("IF v_remaining = 0 THEN");
    expect(migration).toContain("RETURN;");
    expect(migration).toContain("IF v_remaining <> 5 THEN");
  });

  it("requires the exact historical invoice fingerprint before any delete", () => {
    expect(migration).toContain("i.created_at >= timestamptz '2026-08-09 00:00:00+00'");
    expect(migration).toContain("i.created_at < timestamptz '2026-08-10 00:00:00+00'");
    expect(migration).toContain("i.status = 'PAID'");
    expect(migration).toContain("i.total_amount = 10.000");
    expect(migration).toContain("i.amount_paid = 0.000");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.invoice_id = i.id)");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.checkout_idempotency c WHERE c.invoice_id = i.id)");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.entitlement_ledger e WHERE e.invoice_id = i.id)");
    expect(migration).toContain("NOT EXISTS (SELECT 1 FROM public.inventory_consumptions c WHERE c.invoice_id = i.id)");
    expect(migration).toContain("IF v_eligible <> 5 OR v_distinct_customers <> 5 THEN");
  });

  it("deletes only the fixed five serials inside the canonical seeded center", () => {
    expect(migration).toContain("v_demo_center CONSTANT uuid := '7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d'");
    expect(migration.match(/INV-20260809-[A-Z0-9]+/g)).toHaveLength(5);
    expect(migration).toContain("i.center_id = v_demo_center");
    expect(migration).toContain("i.serial_number = ANY (v_target_serials)");
    expect(migration).toContain("IF v_deleted <> 5 THEN");
  });
});
