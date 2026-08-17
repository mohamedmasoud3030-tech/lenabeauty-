import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260817000001_authorization_boundary_repair.sql"),
  "utf8",
);
const inventory = JSON.parse(readFileSync(
  resolve(process.cwd(), "docs/database-contract/artifacts/schema-inventory.json"),
  "utf8",
));
const repositories = readFileSync(
  resolve(process.cwd(), "src/infrastructure/supabase/repositories.ts"),
  "utf8",
);

const sensitiveRpcs = [
  "upsert_notification_settings_v1",
  "upsert_payment_gateway_settings_v1",
  "create_customer_review_v1",
  "create_service_file_v1",
  "create_accounting_journal_entry_v1",
  "create_ai_booking_lead_v1",
  "refund_entitlement_v1",
  "void_entitlement_v1",
  "expire_entitlement_v1",
];

describe("authorization boundary repair", () => {
  it("replays sensitive public RPCs as pinned ADMIN-checking wrappers", () => {
    for (const name of sensitiveRpcs) {
      const fn = inventory.functions.find((entry: any) => entry.schema === "public" && entry.name === name);
      expect(fn, `${name} is present`).toBeTruthy();
      expect(fn.security_definer, `${name} stays SECURITY DEFINER`).toBe(true);
      expect(fn.config).toContain("search_path=pg_catalog, public, app_private");
      expect(fn.definition, `${name} checks the server-governed center role`).toContain("has_center_role");
      expect(fn.definition, `${name} requires ADMIN`).toContain("ADMIN");
    }
  });

  it("keeps renamed implementations non-executable by browser roles", () => {
    const privateImplementations = inventory.functions.filter((entry: any) => entry.name.includes("_admin_impl_v1"));
    expect(privateImplementations).toHaveLength(sensitiveRpcs.length);
    for (const fn of privateImplementations) {
      const clientGrant = inventory.function_acl.find((acl: any) =>
        acl.schema === fn.schema && acl.name === fn.name && ["authenticated", "anon", "public"].includes(acl.grantee),
      );
      expect(clientGrant, `${fn.name} has no client grant`).toBeUndefined();
    }
  });

  it("changes direct admin-table policies from membership to ADMIN role checks", () => {
    for (const table of [
      "expenses",
      "notification_settings",
      "payment_gateway_settings",
      "accounting_journal_entries",
      "ai_booking_leads",
      "customer_reviews",
      "service_files",
      "service_file_images",
      "customer_notification_timeline",
    ]) {
      const policies = inventory.policies.filter((entry: any) => entry.table === table);
      expect(policies.length, `${table} has a policy`).toBeGreaterThan(0);
      for (const policy of policies) {
        expect(`${policy.qual ?? ""} ${policy.with_check ?? ""}`, `${table}.${policy.name}`).toContain("has_center_role");
        expect(`${policy.qual ?? ""} ${policy.with_check ?? ""}`, `${table}.${policy.name}`).toContain("ADMIN");
      }
    }
  });

  it("redacts compensation for operational employee lists and governs writes", () => {
    const listFn = inventory.functions.find((entry: any) => entry.name === "list_employees_v1");
    expect(listFn.definition).toContain("- 'salary'");
    expect(listFn.definition).toContain("- 'base_salary'");
    expect(listFn.definition).toContain("has_center_role");

    for (const name of ["admin_create_employee_v1", "admin_update_employee_v1", "admin_delete_employee_v1"]) {
      const fn = inventory.functions.find((entry: any) => entry.name === name);
      expect(fn.definition).toContain("has_center_role");
      expect(fn.definition).toContain("ADMIN");
      expect(repositories).toContain(`rpc('${name}'`);
    }
    expect(repositories).toContain("rpc('list_employees_v1'");
    expect(migration).toMatch(/GRANT SELECT \(id, center_id, name, role, phone, is_active, created_at, updated_at\)/i);
    expect(migration).toMatch(/REVOKE SELECT ON public\.employees FROM authenticated/i);
  });
});
