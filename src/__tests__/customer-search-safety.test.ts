import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repositories = readFileSync(
  resolve(process.cwd(), "src/infrastructure/supabase/repositories.ts"),
  "utf8",
);
const customerBlock = repositories.slice(
  repositories.indexOf("class SupabaseCustomerAdapter"),
  repositories.indexOf("class SupabaseEmployeeAdapter"),
);

describe("customer search safety", () => {
  it("does not interpolate user text into PostgREST raw or grammar", () => {
    expect(customerBlock).not.toContain(".or(`");
    expect(customerBlock).toContain(".ilike('name', `%${q}%`)");
    expect(customerBlock).toContain(".ilike('phone', `%${q}%`)");
  });

  it("bounds suggestion searches and merges duplicates", () => {
    expect(customerBlock.match(/\.limit\(50\)/g)).toHaveLength(2);
    expect(customerBlock).toContain("new Map<string, any>()");
  });

  it("does not interpolate any user search into raw PostgREST disjunction grammar", () => {
    expect(repositories).not.toMatch(/\.or\s*\(/);
    expect(repositories).toContain("[item.customerName, item.giftCardCode, item.instrumentName]");
  });
});
