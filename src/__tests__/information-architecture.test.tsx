import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import Sidebar from "../ui/layout/Sidebar";
import { GlobalSearch } from "../shared/components/GlobalSearch";
import { NavigationNotice } from "../shared/components/NavigationNotice";
import { resolvePostLoginPath } from "../pages/LoginPage";
import {
  NAV_DESTINATIONS,
  NAV_GROUPS,
  MOBILE_PRIMARY_PATHS,
  MOBILE_MORE_PATHS,
  destinationLabelKey,
  visibleDestinations,
} from "../app/navigation";
import { useCases } from "../app/composition/useCases";
import { UserRole } from "../domain/entities/Session";
import i18n from "../i18n";

/**
 * Information-architecture acceptance suite (INFORMATION_ARCHITECTURE.md §5).
 *
 * Covers route/registry integrity, naming consistency, role boundaries,
 * deep links, mobile/desktop parity, and orientation.
 */

const routesSource = readFileSync(resolve(process.cwd(), "src/routes.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "src/ui/layout/Layout.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "src/ui/layout/Sidebar.tsx"), "utf8");
const searchSource = readFileSync(resolve(process.cwd(), "src/shared/components/GlobalSearch.tsx"), "utf8");
const guardsSource = readFileSync(resolve(process.cwd(), "src/route-guards.tsx"), "utf8");

/** Every `path="..."` declared in routes.tsx, excluding wildcards and root. */
function declaredRoutePaths(): string[] {
  return [...routesSource.matchAll(/path="(\/[^"]*)"/g)]
    .map((m) => m[1])
    .filter((p) => p !== "/" && !p.includes("*"));
}

/** Paths that only exist as legacy redirects into a Settings tab. */
const LEGACY_REDIRECTS = ["/branding", "/notifications", "/payment-gateway"];

const authState = { role: UserRole.ADMIN as UserRole };
vi.mock("../auth", () => ({
  useAuth: () => ({
    me: { id: "u1", username: "user@salon.com", role: authState.role, name: "User" },
    logout: vi.fn(),
  }),
}));

afterAll(async () => {
  await i18n.changeLanguage("ar");
});

/* ── Route / registry integrity ──────────────────────────────────────────── */

describe("route and registry integrity", () => {
  it("IA-T1 — every registry destination is a real declared route", () => {
    const declared = new Set(declaredRoutePaths());
    for (const destination of NAV_DESTINATIONS) {
      expect(declared, `registry lists ${destination.path} but no route declares it`)
        .toContain(destination.path);
    }
  });

  it("IA-T1b — every declared route is in the registry or is a legacy redirect", () => {
    // Authentication utility routes are intentionally reachable without an
    // in-app navigation entry. They are destinations for signed-out/recovery
    // flows, not product modules that belong in the app navigation registry.
    const PUBLIC_ROUTES = ["/login", "/reset-password"];
    for (const path of declaredRoutePaths()) {
      if (LEGACY_REDIRECTS.includes(path) || PUBLIC_ROUTES.includes(path)) continue;
      expect(
        NAV_DESTINATIONS.some((d) => d.path === path),
        `route ${path} exists but is missing from the navigation registry`,
      ).toBe(true);
    }
  });

  it("IA-T3 — no destination is reachable by search only", () => {
    const grouped = new Set(NAV_GROUPS.map((g) => g.id));
    for (const destination of NAV_DESTINATIONS) {
      expect(grouped, `${destination.path} has an unknown group`).toContain(destination.group);
    }

    // Deferred modules were hidden from every menu yet still searchable, which
    // advertised unfinished screens. Deferral must now apply to BOTH surfaces.
    const searchable = new Set(
      NAV_DESTINATIONS.filter((d) => !d.deferred).map((d) => d.path),
    );
    const navigable = new Set(
      visibleDestinations({ isAdmin: true, optionalModules: { giftCards: true, packages: true } })
        .map((d) => d.path),
    );
    for (const path of searchable) {
      expect(navigable, `${path} is searchable but has no menu entry`).toContain(path);
    }
    for (const path of ["/customer-experience", "/forecasting", "/accounting", "/advanced-automation"]) {
      expect(searchable, `${path} is deferred and must not be searchable`).not.toContain(path);
    }
  });

  it("IA-T3b — deferred modules keep working routes so saved links never break", () => {
    const declared = new Set(declaredRoutePaths());
    const adminBlock = routesSource.slice(routesSource.indexOf("<Route element={<RequireAdmin />}>"));
    for (const destination of NAV_DESTINATIONS.filter((d) => d.deferred)) {
      expect(declared, `${destination.path} must remain routable`).toContain(destination.path);
      expect(adminBlock, `${destination.path} must remain guarded`).toContain(`path="${destination.path}"`);
    }
  });

  it("IA-T1c — registry paths are unique", () => {
    const paths = NAV_DESTINATIONS.map((d) => d.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

/* ── Naming ──────────────────────────────────────────────────────────────── */

