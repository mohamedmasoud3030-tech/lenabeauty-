import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routes = readFileSync(resolve(process.cwd(), "src/routes.tsx"), "utf8");

describe("client-trial route context", () => {
  it("keeps legacy settings routes but redirects them into consolidated sections", () => {
    expect(routes).toContain('path="/branding" element={<Navigate to="/settings?tab=branding" replace />}');
    expect(routes).toContain('path="/notifications" element={<Navigate to="/settings?tab=notifications" replace />}');
    expect(routes).toContain('path="/payment-gateway" element={<Navigate to="/settings?tab=payments" replace />}');
  });

  it("retains deferred module routes behind the admin guard", () => {
    const adminBlock = routes.slice(routes.indexOf('<Route element={<RequireAdmin />}>'));
    for (const path of [
      "/customer-experience", "/forecasting", "/expenses", "/attendance",
      "/advances", "/payroll", "/staff-analytics", "/accounting", "/advanced-automation",
    ]) {
      expect(adminBlock).toContain(`path="${path}"`);
    }
  });
});
