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
const mobileSheetSource = readFileSync(resolve(process.cwd(), "src/ui/layout/MobileNavigationSheet.tsx"), "utf8");
const mobileDockSource = readFileSync(resolve(process.cwd(), "src/ui/layout/MobileActionDock.tsx"), "utf8");
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
    // `/login` is the public entry point and deliberately has no in-app
    // navigation entry.
    const PUBLIC_ROUTES = ["/login"];
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

  it("IA-T1d — /dashboard mounts the degradation wrapper, which delegates to the full dashboard", () => {
    // The routed owner of /dashboard is DashboardCompatPage, NOT DashboardPage.
    // It probes the dashboard summary contract and degrades to a reduced
    // operational dashboard when the hosted schema cannot serve it. Guard both
    // halves of the wiring: the route must keep the degradation path, and the
    // wrapper must keep delegating to the real page so the full dashboard can
    // never be silently unmounted by a refactor.
    expect(routesSource).toContain(
      'const DashboardCompatPage = lazy(() => import("./pages/DashboardCompatPage"))',
    );
    const dashboardRoute = routesSource.slice(routesSource.indexOf('path="/dashboard"'));
    expect(dashboardRoute).toContain("<DashboardCompatPage />");

    const compat = readFileSync(resolve(process.cwd(), "src/pages/DashboardCompatPage.tsx"), "utf8");
    expect(compat).toContain('import DashboardPage from "./DashboardPage"');
    expect(compat).toContain("useCases.dashboard.getSummary()");
    expect(compat).toContain("return <DashboardPage />");
  });
});

/* ── Naming ──────────────────────────────────────────────────────────────── */

describe("naming consistency", () => {
  it("IA-T4 — sidebar, layout and search all read names from the registry", () => {
    // None of them may hand-roll a page-name list any more.
    for (const [name, source] of [
      ["Sidebar", sidebarSource],
      ["Layout", layoutSource],
      ["GlobalSearch", searchSource],
    ] as const) {
      expect(source, `${name} must import the shared navigation registry`)
        .toMatch(/from "\.\.\/\.\.\/app\/navigation"/);
    }
    // The Layout's old hardcoded title map is gone.
    expect(layoutSource).not.toMatch(/"\/attendance":\s*"Attendance"/);
    expect(layoutSource).toContain("destinationLabelKey");
  });

  it("IA-T5 — every destination and group name resolves in Arabic and English", async () => {
    for (const lang of ["ar", "en"]) {
      await i18n.changeLanguage(lang);
      for (const destination of NAV_DESTINATIONS) {
        expect(i18n.exists(destination.labelKey), `${lang}: missing ${destination.labelKey}`).toBe(true);
        expect(i18n.t(destination.labelKey).trim()).not.toBe("");
      }
      for (const group of NAV_GROUPS) {
        expect(i18n.exists(group.titleKey), `${lang}: missing group ${group.titleKey}`).toBe(true);
      }
    }
  });

  it("IA-T5b — no Arabic label leaks into the English UI", async () => {
    // i18n falls back to Arabic, so an English-only gap silently renders
    // Arabic. This regressed for Attendance/Advances/Payroll/Staff Analytics.
    await i18n.changeLanguage("en");
    const arabic = /[\u0600-\u06ff]/;
    for (const destination of NAV_DESTINATIONS) {
      expect(arabic.test(i18n.t(destination.labelKey)), `English leak: ${destination.labelKey}`).toBe(false);
    }
    for (const group of NAV_GROUPS) {
      expect(arabic.test(i18n.t(group.titleKey)), `English leak: ${group.titleKey}`).toBe(false);
    }
  });

  it("IA-T6 — retired aliases are gone from navigation surfaces", () => {
    // /pos was "POS" in two places and "Sales & Invoices" in search.
    expect(destinationLabelKey("/pos")).toBe("Point of Sale");
    for (const source of [sidebarSource, layoutSource, searchSource]) {
      expect(source).not.toContain('"Sales & Invoices"');
      expect(source).not.toContain('"Posinvoices"');
    }
  });
});

/* ── Roles and permission boundaries ─────────────────────────────────────── */

describe("role scoping and permission boundaries", () => {
  beforeEach(() => {
    vi.spyOn(useCases.giftCards, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.servicePackages, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  it("IA-T7 — STAFF sees no admin destination", () => {
    const visible = visibleDestinations({ isAdmin: false, optionalModules: { giftCards: true, packages: true } });
    expect(visible.every((d) => !d.adminOnly)).toBe(true);
    // And every admin route is genuinely excluded.
    for (const path of ["/reports", "/settings", "/payroll", "/accounting", "/forecasting"]) {
      expect(visible.some((d) => d.path === path), `${path} must be hidden from STAFF`).toBe(false);
    }
  });

  it("IA-T7b — ADMIN sees every shipped destination", () => {
    const visible = visibleDestinations({ isAdmin: true, optionalModules: { giftCards: true, packages: true } });
    expect(visible).toHaveLength(NAV_DESTINATIONS.filter((d) => !d.deferred).length);
    expect(visible.some((d) => d.deferred)).toBe(false);
  });

  it("IA-T8/IA-T10 — hiding is never the authorization control", () => {
    // Every adminOnly destination must sit inside the RequireAdmin block.
    const adminBlock = routesSource.slice(routesSource.indexOf("<Route element={<RequireAdmin />}>"));
    for (const destination of NAV_DESTINATIONS.filter((d) => d.adminOnly)) {
      expect(adminBlock, `${destination.path} is hidden but not guarded`)
        .toContain(`path="${destination.path}"`);
    }
    // And the guard checks the role, not the menu.
    expect(guardsSource).toContain("user.role !== UserRole.ADMIN");
  });

  it("IA-T9 — MANAGER is operational, matching can()", async () => {
    const { can } = await import("../domain/entities/Session");
    const session = {
      status: "authenticated" as const,
      session: { user: { id: "m", username: "m@x.c", role: UserRole.MANAGER } },
    };
    expect(can(session, "appointments.view")).toBe(true);
    expect(can(session, "pos.checkout")).toBe(true);
    // Admin-only capability is not granted to MANAGER.
    expect(can(session, "reports.view")).toBe(false);
  });

  it("IA-T7c — STAFF cannot see admin destinations in the rendered sidebar", async () => {
    authState.role = UserRole.STAFF;
    await i18n.changeLanguage("en");
    render(<MemoryRouter><Sidebar /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(i18n.t("Dashboard"))).toBeInTheDocument());
    for (const label of ["Reports", "Settings", "Payroll", "Accounting", "Forecasting", "Employees"]) {
      expect(screen.queryByText(i18n.t(label)), `STAFF must not see ${label}`).not.toBeInTheDocument();
    }
    authState.role = UserRole.ADMIN;
  });

  it("IA-T7d — STAFF cannot reach admin destinations through search", async () => {
    await i18n.changeLanguage("en");
    render(<MemoryRouter><GlobalSearch userRole="STAFF" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Search") }));
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "payroll" } });
    expect(screen.queryByRole("option", { name: /Payroll/i })).not.toBeInTheDocument();
  });
});

/* ── Discoverability ─────────────────────────────────────────────────────── */

describe("discoverability of previously hidden features", () => {
  beforeEach(() => {
    authState.role = UserRole.ADMIN;
    vi.spyOn(useCases.giftCards, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.servicePackages, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  it("IA-T2 — deferred modules stay out of navigation AND search", async () => {
    await i18n.changeLanguage("en");
    const { unmount } = render(<MemoryRouter><Sidebar /></MemoryRouter>);
    await screen.findByText(i18n.t("Dashboard"));

    for (const label of ["Customer Experience", "Forecasting", "Accounting", "Automation"]) {
      expect(screen.queryByText(i18n.t(label)), `${label} is deferred and must stay hidden`)
        .not.toBeInTheDocument();
    }
    unmount();

    render(<MemoryRouter><GlobalSearch userRole="ADMIN" /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Search") }));
    const input = screen.getByRole("combobox");
    for (const term of ["forecast", "accounting", "automation", "experience"]) {
      fireEvent.change(input, { target: { value: term } });
      expect(
        screen.queryAllByRole("option"),
        `search for "${term}" must not surface a deferred module`,
      ).toHaveLength(0);
    }
  });

  it("IA-T2b — admin sees every shipped, non-optional destination in the sidebar", async () => {
    await i18n.changeLanguage("en");
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    const nav = await screen.findByRole("navigation", { name: i18n.t("Primary navigation") });

    for (const destination of NAV_DESTINATIONS.filter((d) => !d.optionalModule && !d.deferred)) {
      expect(
        within(nav).getByText(i18n.t(destination.labelKey)),
        `${destination.path} missing from sidebar`,
      ).toBeInTheDocument();
    }
  });
});

/* ── Mobile / desktop parity ─────────────────────────────────────────────── */

describe("mobile and desktop parity", () => {
  it("IA-T17 — phones use an icon dock, not a destination-style bottom bar", () => {
    expect(MOBILE_PRIMARY_PATHS).toHaveLength(0);
    expect(layoutSource).toContain("<MobileActionDock");
    expect(layoutSource).toContain("<MobileNavigationSheet");
    expect(mobileDockSource).toContain("<Menu");
    expect(mobileDockSource).toContain("<GlobalSearch");
    expect(mobileDockSource).toContain("<Plus");
  });

  it("IA-T16 — every shipped destination is mobile-reachable", () => {
    const mobileReachable = new Set<string>([...MOBILE_PRIMARY_PATHS, ...MOBILE_MORE_PATHS]);
    for (const destination of NAV_DESTINATIONS.filter((d) => !d.deferred)) {
      expect(mobileReachable, `${destination.path} is not reachable on mobile`).toContain(destination.path);
    }
    // Desktop and mobile expose exactly the same destination set.
    const desktop = visibleDestinations({ isAdmin: true, optionalModules: { giftCards: true, packages: true } });
    expect(new Set(desktop.map((d) => d.path))).toEqual(mobileReachable);
  });

  it("IA-T15 — mobile never shows a destination the desktop navigation hides", () => {
    const ctx = { isAdmin: true, optionalModules: { giftCards: false, packages: false } };
    const visible = new Set(visibleDestinations(ctx).map((d) => d.path));
    expect(visible.has("/gift-cards")).toBe(false);
    expect(visible.has("/packages")).toBe(false);
    expect(mobileSheetSource).toContain("visibleDestinations");
    expect(mobileSheetSource).not.toMatch(/labelKey:\s*"Gift Cards"/);
  });
});

/* ── Deep links, refresh, back/forward ───────────────────────────────────── */

describe("deep links and post-login return", () => {
  it("IA-T11 — a deep link requested while signed out is restored after sign-in", () => {
    expect(resolvePostLoginPath({ pathname: "/reports" })).toBe("/reports");
    expect(resolvePostLoginPath({ pathname: "/settings", search: "?tab=branding" }))
      .toBe("/settings?tab=branding");
  });

  it("IA-T11b — the return path can never become an open redirect", () => {
    for (const hostile of [
      { pathname: "//evil.example.com" },
      { pathname: "https://evil.example.com" },
      { pathname: "evil" },
      { pathname: "/login" },
      { pathname: "/" },
      null,
      undefined,
      "string",
    ]) {
      expect(resolvePostLoginPath(hostile), `unsafe redirect accepted: ${JSON.stringify(hostile)}`)
        .toBe("/dashboard");
    }
  });

  it("IA-T12 — guards preserve the attempted location for restoration", () => {
    expect(guardsSource).toContain("state={{ from: location }}");
  });

  it("IA-T14 — legacy settings deep links still redirect", () => {
    expect(routesSource).toContain('path="/branding" element={<Navigate to="/settings?tab=branding" replace />}');
    expect(routesSource).toContain('path="/notifications" element={<Navigate to="/settings?tab=notifications" replace />}');
    expect(routesSource).toContain('path="/payment-gateway" element={<Navigate to="/settings?tab=payments" replace />}');
  });

  it("IA-T13 — settings tabs are deep-linkable and refresh-safe", () => {
    const settings = readFileSync(resolve(process.cwd(), "src/pages/SettingsPage.tsx"), "utf8");
    expect(settings).toContain("searchParams.get(\"tab\")");
    expect(settings).toContain("setSearchParams");
  });
});

/* ── Orientation: explained refusals ─────────────────────────────────────── */

describe("orientation and explained refusals", () => {
  function renderWithNotice(state: unknown) {
    function Probe() {
      const location = useLocation();
      // A plain <span>: <output> carries an implicit role="status", which
      // would collide with the notice's own status role in these queries.
      return <span data-testid="router-state">{JSON.stringify(location.state)}</span>;
    }
    return render(
      <MemoryRouter initialEntries={[{ pathname: "/dashboard", state }]}>
        <Routes>
          <Route path="/dashboard" element={<><NavigationNotice /><Probe /></>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("IA-T19 — an admin-only refusal is explained, not silent", async () => {
    renderWithNotice({ navigationNotice: "admin-only", attemptedPath: "/payroll" });
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(
      i18n.t("That page is available to administrators only. You were returned to the dashboard."),
    );
    expect(notice).toHaveTextContent("/payroll");
  });

  it("IA-T19b — an unknown route is explained", async () => {
    renderWithNotice({ navigationNotice: "not-found", attemptedPath: "/nope" });
    expect(await screen.findByRole("status")).toHaveTextContent(
      i18n.t("That page does not exist. You were returned to the dashboard."),
    );
  });

  it("IA-T19c — a normal visit shows no notice", () => {
    renderWithNotice(null);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("IA-T19d — the notice is cleared from history so refresh does not replay it", async () => {
    renderWithNotice({ navigationNotice: "not-found", attemptedPath: "/nope" });
    await screen.findByRole("status");
    await waitFor(() => expect(screen.getByTestId("router-state")).toHaveTextContent("null"));
  });

  it("IA-T19e — both redirect sources attach a reason", () => {
    expect(guardsSource).toContain('navigationNotice: "admin-only"');
    expect(routesSource).toContain('navigationNotice: "not-found"');
  });
});

/* ── Accessibility and RTL ───────────────────────────────────────────────── */

describe("navigation accessibility and RTL", () => {
  beforeEach(() => {
    authState.role = UserRole.ADMIN;
    vi.spyOn(useCases.giftCards, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.servicePackages, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  it("IA-T18 — the active destination is marked aria-current=page", async () => {
    await i18n.changeLanguage("en");
    render(
      <MemoryRouter initialEntries={["/appointments"]}>
        <Sidebar />
      </MemoryRouter>,
    );
    const active = await screen.findByRole("link", { name: new RegExp(i18n.t("Appointments")) });
    expect(active).toHaveAttribute("aria-current", "page");
  });

  it("IA-T21 — navigation landmarks have accessible names", async () => {
    await i18n.changeLanguage("en");
    render(<MemoryRouter><Sidebar /></MemoryRouter>);
    expect(await screen.findByRole("navigation", { name: i18n.t("Primary navigation") })).toBeInTheDocument();
  });

  it("IA-T20 — navigation uses logical direction properties and mirrors chevrons", () => {
    const physical = /\b(?:ml|mr|pl|pr)-\d|\btext-(?:left|right)\b/;
    for (const [name, source] of [
      ["Sidebar", sidebarSource],
      ["Layout", layoutSource],
      ["GlobalSearch", searchSource],
    ] as const) {
      expect(source, `${name} uses a physical-direction class`).not.toMatch(physical);
    }
    // Directional icons flip for Arabic.
    expect(sidebarSource).toContain('i18n.language === "ar" && "rotate-180"');
  });

  it("IA-T11c — orphan pages for deny-by-default features are gone", () => {
    expect(existsSync(resolve(process.cwd(), "src/pages/BookingPage.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "src/pages/ClientPortalPage.tsx"))).toBe(false);
  });
});
