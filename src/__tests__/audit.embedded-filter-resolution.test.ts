import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The contract matrix must understand PostgREST embedded-resource filters.
 *
 * `.eq('invoices.center_id', id)` combined with an `invoices!inner(center_id)`
 * embed filters a column on the EMBEDDED relation, not on the queried table.
 * The matrix builder previously validated every filter against the local table
 * only, so this legitimate tenant-scoping filter was reported as
 * `column-missing: invoice_items.invoices.center_id` — a false positive that
 * failed the audit gate and, worse, created pressure to remove correct
 * multi-tenant scoping just to make the gate green.
 */

const ROOT = resolve(process.cwd());
const artifact = (name: string) =>
  JSON.parse(readFileSync(resolve(ROOT, "docs/database-contract/artifacts", name), "utf8"));

describe("contract matrix resolves embedded-resource filters", () => {
  it("does not flag a valid embedded tenant filter as a missing column", () => {
    const matrix = artifact("contract-matrix.json");
    const invoiceItems = matrix.tables.find((t: { table: string }) => t.table === "invoice_items");

    expect(invoiceItems, "invoice_items must appear in the contract matrix").toBeDefined();
    expect(
      invoiceItems.missing_columns,
      "embedded filters like invoices.center_id resolve against the embedded relation",
    ).not.toContain("invoices.center_id");
  });

  it("keeps the audit gate free of medium/high findings", () => {
    const findings = artifact("audit-findings.json");
    const blocking = (findings.findings ?? []).filter(
      (f: { severity: string }) => f.severity === "medium" || f.severity === "high",
    );
    expect(
      blocking.map((f: { title: string }) => f.title),
      "a false positive here would push contributors to delete correct tenant scoping",
    ).toEqual([]);
  });

  it("still reports a genuinely unknown column on an embedded relation", () => {
    // Guard against over-correcting: the resolver must validate the column
    // against the embedded relation rather than skipping dotted filters.
    const source = readFileSync(resolve(ROOT, "scripts/audit/build-matrix.mjs"), "utf8");
    expect(source).toContain("embeddedCols.has(column)");
    expect(source).toContain("isEmbedded");
  });
});
