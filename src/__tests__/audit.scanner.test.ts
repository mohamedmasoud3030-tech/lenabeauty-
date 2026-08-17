import { describe, it, expect } from "vitest";
// @ts-ignore — plain-JS audit tooling shipped without type declarations
import { splitStatements, translateMigration, discoverMigrations, compatPreamble } from "../../scripts/audit/lib/sql.mjs";
// @ts-ignore — plain-JS audit tooling shipped without type declarations
import { parseSelect, topLevelObjectKeys } from "../../scripts/audit/lib/parse.mjs";

describe("audit: SQL statement splitter", () => {
  it("splits on top-level semicolons and ignores them inside dollar-quoted bodies", () => {
    const sql = `
      CREATE TABLE t (id uuid primary key);
      CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$
        BEGIN
          PERFORM 1;
          PERFORM 2;
        END;
      $$;
      SELECT 'a;b';
    `;
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toMatch(/CREATE TABLE t/);
    expect(stmts[1]).toContain("PERFORM 1;");
    expect(stmts[2]).toContain("a;b");
  });

  it("ignores semicolons inside single-quoted strings and line comments", () => {
    const stmts = splitStatements("SELECT 'x;y'; -- comment; still comment\nSELECT 1;");
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toContain("'x;y'");
  });

  it("handles tagged dollar quotes", () => {
    const stmts = splitStatements("CREATE FUNCTION f() AS $body$ SELECT ';' $body$; SELECT 2;");
    expect(stmts).toHaveLength(2);
  });
});

describe("audit: migration discovery", () => {
  it("discovers 36 canonical migrations and excludes only the manual bootstrap", () => {
    const all = discoverMigrations();
    expect(all).toHaveLength(36);
    const automated = all.filter((m) => m.file !== "20260628000002_admin_bootstrap.sql");
    expect(automated).toHaveLength(35);
    expect(all.some((m) => m.file === "20260628000002_admin_bootstrap.sql")).toBe(true);
  });
});

describe("audit: translation layer", () => {
  it("strips CREATE EXTENSION statements (even after a leading comment header) with a logged translation", () => {
    const { sql, translations } = translateMigration('-- header\nCREATE EXTENSION IF NOT EXISTS "pgcrypto";\nSELECT 1;');
    expect(sql).not.toMatch(/CREATE EXTENSION/i);
    expect(sql).toContain("SELECT 1;");
    expect(translations.some((t) => t.type === "extension-skipped")).toBe(true);
  });

  it("surrogates the btree_gist EXCLUDE constraint inside its DO block and logs it", () => {
    const source = `
      DO $$
      BEGIN
        ALTER TABLE public.appointments
          ADD CONSTRAINT appointments_no_scheduled_staff_overlap
          EXCLUDE USING gist (center_id WITH =, employee_id WITH =)
          WHERE (status = 'SCHEDULED');
      END;
      $$;
    `;
    const { sql, translations } = translateMigration(source);
    expect(sql).not.toMatch(/EXCLUDE USING gist/);
    expect(sql).toMatch(/RAISE NOTICE/);
    expect(sql).toMatch(/DO \$\$/);
    expect(translations.some((t) => t.type === "exclude-constraint-surrogated")).toBe(true);
  });

  it("compatibility preamble stubs auth/storage and roles", () => {
    const preamble = compatPreamble();
    expect(preamble.some((s) => s.includes("CREATE ROLE anon"))).toBe(true);
    expect(preamble.some((s) => s.includes("CREATE ROLE authenticated"))).toBe(true);
    expect(preamble.some((s) => s.includes("auth.users"))).toBe(true);
    expect(preamble.some((s) => s.includes("storage.buckets"))).toBe(true);
  });
});

describe("audit: PostgREST select parser", () => {
  it("parses star selects with no embeds", () => {
    expect(parseSelect("*")).toEqual({ hasStar: true, columns: [], embeds: [] });
  });

  it("parses a to-one embed with explicit columns", () => {
    const r: any = parseSelect("*, service_categories(name)");
    expect(r.hasStar).toBe(true);
    expect(r.embeds).toEqual([{ relation: "service_categories", join: "default", columns: ["name"], embeds: [] }]);
  });

  it("parses an aliased embed (alias:relation(cols))", () => {
    const r: any = parseSelect("*, images:service_file_images(*)");
    expect(r.embeds[0].relation).toBe("service_file_images");
    expect(r.embeds[0].columns).toEqual(["*"]);
  });

  it("parses a hint-qualified embed (relation!inner(cols))", () => {
    const r: any = parseSelect("invoice_items!inner(id)");
    expect(r.embeds).toEqual([{ relation: "invoice_items", join: "inner", columns: ["id"], embeds: [] }]);
  });

  it("resolves nested embeds (depth 2) recursively", () => {
    const r: any = parseSelect("*, package_entitlement_units (id, services (name))");
    expect(r.embeds[0].relation).toBe("package_entitlement_units");
    expect(r.embeds[0].columns).toContain("id");
    expect(r.embeds[0].embeds).toEqual([{ relation: "services", join: "default", columns: ["name"], embeds: [] }]);
  });

  it("strips ::casts and alias prefixes from column names", () => {
    const r: any = parseSelect("id, total::numeric, source_invoice:invoices(serial_number)");
    expect(r.columns).toContain("id");
    expect(r.columns).toContain("total");
    expect(r.embeds[0].relation).toBe("invoices");
  });
});

describe("audit: object-literal key parser", () => {
  it("extracts top-level keys and ignores nested object keys", () => {
    const keys = topLevelObjectKeys(`p_center_id: 1, p_items: [{ serviceId: "s", qty: 2 }], p_ok: true`);
    expect(keys).toEqual(["p_center_id", "p_items", "p_ok"]);
  });

  it("handles ternary expressions without dropping keys", () => {
    const keys = topLevelObjectKeys(`p_entitlement_redemptions: xs.length ? xs : null, p_use_loyalty_points: true`);
    expect(keys).toContain("p_entitlement_redemptions");
    expect(keys).toContain("p_use_loyalty_points");
    expect(keys).toHaveLength(2);
  });
});
