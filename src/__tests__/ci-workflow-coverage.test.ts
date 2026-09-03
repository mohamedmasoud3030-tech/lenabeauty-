import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/demo-supabase-migrations.yml"),
  "utf8",
);

const productionWorkflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/production-supabase-release.yml"),
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

  it("keeps Production schema mutation manual, main-only and environment-gated", () => {
    expect(productionWorkflow).toMatch(/on:\s*\n\s+workflow_dispatch:/);
    expect(productionWorkflow).not.toMatch(/\n\s+push:/);
    expect(productionWorkflow).not.toMatch(/\n\s+pull_request:/);
    expect(productionWorkflow).toContain('if [ "$GITHUB_REF" != "refs/heads/main" ]');
    expect(productionWorkflow).toContain("environment: production");
    expect(productionWorkflow).toContain("recovery_confirmed:");
    expect(productionWorkflow).toContain('if [ "$RECOVERY_CONFIRMED" != "true" ]');
  });

  it("binds Production release to typed project/center confirmations and server-only secrets", () => {
    expect(productionWorkflow).toContain('if [ "$CONFIRMED_PROJECT_REF" != "$SUPABASE_PROJECT_REF" ]');
    expect(productionWorkflow).toContain('if [ "$CONFIRMED_CENTER_ID" != "$VITE_CENTER_ID" ]');
    expect(productionWorkflow).toContain('if [ "$SUPABASE_PROJECT_REF" = "tuzzvqsnbtzvkffmazyf" ]');
    expect(productionWorkflow).toContain("PRODUCTION_SUPABASE_PROJECT_REF: ${{ secrets.PRODUCTION_SUPABASE_PROJECT_REF }}");
    expect(productionWorkflow).toContain("SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY }}");
    expect(productionWorkflow).not.toContain("VITE_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("runs Production preflight and suppresses the manual bootstrap before db push", () => {
    const launchPreflight = productionWorkflow.indexOf("npm run launch:preflight");
    const repair = productionWorkflow.indexOf("supabase migration repair 20260628000002 --status applied");
    const push = productionWorkflow.indexOf("supabase db push --linked --yes");
    const livePreflight = productionWorkflow.indexOf("npm run preflight:supabase");

    expect(launchPreflight).toBeGreaterThan(0);
    expect(repair).toBeGreaterThan(launchPreflight);
    expect(push).toBeGreaterThan(repair);
    expect(livePreflight).toBeGreaterThan(push);
    expect(productionWorkflow).toContain("without executing its placeholder Auth UUID SQL");
  });

  it("provisions only the configured center shell and then runs rollback-safe Production acceptance", () => {
    expect(productionWorkflow).toContain("Provision the explicitly configured Production center shell");
    expect(productionWorkflow).toContain("INSERT INTO public.centers (id, name)");
    expect(productionWorkflow).toContain("INSERT INTO public.center_settings (center_id, name, currency)");
    expect(productionWorkflow).toContain("for test_file in supabase/tests/*.sql");
    expect(productionWorkflow).toContain("rollback-safe Production acceptance");
  });
});
