import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/demo-supabase-migrations.yml"),
  "utf8",
);

describe("repository CI coverage", () => {
  it("runs static validation for pull requests and every main push", () => {
    expect(workflow).toMatch(/on:\s*\n\s+pull_request:/);
    expect(workflow).toMatch(/pull_request:[\s\S]*?branches: \[main\]/);
    expect(workflow).toMatch(/push:[\s\S]*?branches: \[main\]/);
    expect(workflow).not.toMatch(/push:[\s\S]*?paths:/);
  });

  it("applies Demo migrations only after an explicit workflow dispatch", () => {
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).not.toContain("github.event_name != 'pull_request'");
    expect(workflow).toContain("supabase db push --linked --yes");
  });

  it("executes rollback-safe SQL acceptance files after live migration", () => {
    expect(workflow).toContain("for test_file in supabase/tests/*.sql");
    expect(workflow).toContain("ON_ERROR_STOP=1");
    expect(workflow).toContain("psql");
  });
});
