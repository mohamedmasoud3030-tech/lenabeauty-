import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/demo-supabase-migrations.yml"),
  "utf8",
);

describe("repository CI coverage", () => {
  it("runs static validation for pull requests and every main push on Node 24 actions", () => {
    expect(workflow).toMatch(/on:\s*\n\s+pull_request:/);
    expect(workflow).toMatch(/pull_request:[\s\S]*?branches: \[main\]/);
    expect(workflow).toMatch(/push:[\s\S]*?branches: \[main\]/);
    expect(workflow).not.toMatch(/push:[\s\S]*?paths:/);
    expect(workflow).toContain("actions/checkout@v5");
    expect(workflow).toContain("actions/setup-node@v5");
    expect(workflow).not.toContain("actions/checkout@v4");
    expect(workflow).not.toContain("actions/setup-node@v4");
  });

  it("applies Demo migrations only after an explicit workflow dispatch", () => {
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).not.toContain("github.event_name != 'pull_request'");
    expect(workflow).toContain("supabase db push --linked --yes");
  });

  it("runs read-only attendance and Storage preflight before db push", () => {
    const preflight = workflow.indexOf("Read-only attendance and Storage preflight");
    const push = workflow.indexOf("supabase db push --linked --yes");
    expect(preflight).toBeGreaterThan(0);
    expect(push).toBeGreaterThan(preflight);
    expect(workflow).toContain("having count(*) > 1");
    expect(workflow).toContain("check_out_time <= check_in_time");
    expect(workflow).toContain("work_hours < 0");
    expect(workflow).toContain("where id = 'center-assets'");
    expect(workflow).toContain("no row was changed");
  });

  it("executes rollback-safe SQL acceptance files after live migration", () => {
    expect(workflow).toContain("for test_file in supabase/tests/*.sql");
    expect(workflow).toContain("ON_ERROR_STOP=1");
    expect(workflow).toContain("psql");
  });
});
