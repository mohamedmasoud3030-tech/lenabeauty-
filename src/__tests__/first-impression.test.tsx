import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { AppProvider } from "../context/AppContext";
import { AuthProvider } from "../auth";
import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../shared/components/Toast";
import LoginPage from "../pages/LoginPage";
import { GettingStartedCard } from "../shared/components/GettingStartedCard";
import { useCases } from "../app/composition/useCases";
import * as env from "../config/env";
import i18n from "../i18n";

/**
 * First-impression acceptance suite.
 *
 * The login is intentionally product-facing rather than implementation-facing:
 * it must communicate Lena Beauty, the shipped operating areas, one clear sign
 * in action, and preserve RTL/mobile accessibility without exposing developer
 * or account-provisioning copy in the visual surface.
 */

function bootAuthMocks() {
  vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});
  (env.config as any).centerId = "center-1";
  (env.config as any).branchMode = "single";
  vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: true, data: { status: "anonymous" } });
  vi.spyOn(useCases.auth, "onAuthStateChange").mockReturnValue(() => {});
  vi.spyOn(useCases.auth, "getMyCenters").mockResolvedValue({
    ok: true,
    data: [{ id: "center-1", name: "Lena Beauty", role: "ADMIN" }],
  });
}

function renderLogin() {
  return render(
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <ToastProvider>
            <MemoryRouter initialEntries={["/login"]}>
              <LoginPage />
            </MemoryRouter>
          </ToastProvider>
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>,
  );
}

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(resolve(process.cwd(), dir))) {
    const rel = join(dir, entry);
    const abs = resolve(process.cwd(), rel);
    if (statSync(abs).isDirectory()) out.push(...sourceFilesUnder(rel));
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

afterAll(async () => {
  await i18n.changeLanguage("ar");
});

/* ── A. Can a first-time user identify the product? ──────────────────────── */

describe("A — the pre-auth screen presents Lena Beauty as a finished product", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    bootAuthMocks();
    await i18n.changeLanguage("ar");
  });

  it("A1 — carries the canonical Lena product mark and name", async () => {
    const { container } = renderLogin();
    await waitFor(() => expect(screen.getByLabelText(i18n.t("Work email"))).toBeInTheDocument());
    expect(container.querySelector('img[src="/lena-mark.svg"]')).not.toBeNull();
    expect(container.textContent).toContain("LENA");
    expect(container.textContent).toContain("BEAUTY");
  });

  it("A2 — names the real operating areas without technical qualification copy", async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(i18n.t("Work email"))).toBeInTheDocument());
    const visible = document.body.textContent ?? "";
    for (const label of ["المواعيد", "نقطة البيع", "العملاء", "المخزون", "الموظفون", "التقارير"]) {
      expect(visible).toContain(label);
    }
    expect(visible).not.toContain(i18n.t("For the center's team. This is not a customer booking site."));
    expect(visible).not.toContain(i18n.t("Accounts are created by your center administrator. There is no public sign-up."));
  });

  it("A3 — promises no deny-by-default capability before sign-in", () => {
    const login = readFileSync(resolve(process.cwd(), "src/pages/LoginPage.tsx"), "utf8");
    for (const forbidden of ["Book Now", "Online Booking", "Client Portal", "Open App", "Desktop-Ready", "offline-ready"]) {
      expect(login, `login must not advertise "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it("A4 — visibly connects Lena Beauty to LENA Digital House without turning it into support", async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(i18n.t("Work email"))).toBeInTheDocument());

    expect(screen.getByText("أحد منتجات LENA DIGITAL HOUSE")).toBeInTheDocument();
    const parentLink = screen.getByRole("link", { name: /LENA Digital House/i });
    expect(parentLink).toHaveAttribute("target", "_blank");
    expect(parentLink.getAttribute("href")).toContain("from=lenabeauty");
    expect(parentLink.getAttribute("href")).not.toContain("/support");
  });
});

/* ── B. Does it keep presentation clean? ─────────────────────────────────── */

describe("B — the pre-auth surface contains no developer-facing explanation", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    bootAuthMocks();
    await i18n.changeLanguage("en");
  });

  it("B1 — omits team-workspace, public-signup and database explanations", async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(i18n.t("Work email"))).toBeInTheDocument());
    const visible = document.body.textContent ?? "";
    for (const unwanted of [
      "This is not a customer booking site",
      "There is no public sign-up",
      "visible only to its team",
      "registered by your administrator",
    ]) {
      expect(visible).not.toContain(unwanted);
    }
  });
});

/* ── C. Can they find the primary action? ────────────────────────────────── */

describe("C — exactly one primary action, using the right credential", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    bootAuthMocks();
    await i18n.changeLanguage("ar");
  });

  it("C1 — renders exactly one submit control", async () => {
    const { container } = renderLogin();
    await waitFor(() => expect(screen.getByLabelText(i18n.t("Work email"))).toBeInTheDocument());
    expect(container.querySelectorAll('button[type="submit"]')).toHaveLength(1);
  });

  it("C2 — the credential field is an email input, matching what the auth adapter sends", async () => {
    renderLogin();
    const field = await screen.findByLabelText(i18n.t("Work email"));
    expect(field).toHaveAttribute("type", "email");
    expect(field).toHaveAttribute("autocomplete", "email");
    expect(field).toHaveAttribute("inputmode", "email");
    expect(field).toHaveAttribute("placeholder", "name@yourcenter.com");

    const adapter = readFileSync(resolve(process.cwd(), "src/infrastructure/supabase/repositories.ts"), "utf8");
    expect(adapter).toContain("signInWithPassword({");
    expect(adapter).toContain("email: username");
  });

  it("C3 — the only initial pre-auth link is the secondary parent-brand endorsement", async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(i18n.t("Work email"))).toBeInTheDocument());
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("LENA Digital House");
    expect(links[0]).toHaveAttribute("target", "_blank");
  });
});

/* ── D. First-run guidance after authentication ──────────────────────────── */

describe("D — first-run guidance on an empty center", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("ar");
  });

  function renderGuide() {
    return render(
      <MemoryRouter>
        <GettingStartedCard />
      </MemoryRouter>,
    );
  }

  it("D3 — renders one ordered guide whose first step is creating services", async () => {
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);

    renderGuide();

    expect(await screen.findByText(i18n.t("Set up your center"))).toBeInTheDocument();

    const steps = await screen.findAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveTextContent(i18n.t("Add your services"));
    expect(steps[4]).toHaveTextContent(i18n.t("Record your first sale"));
  });

  it("D4 — retires itself once the center has services, a team and customers", async () => {
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [{ id: "s1" }] } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [{ id: "e1" }] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [{ id: "c1" }] } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);

    renderGuide();

    await waitFor(() => expect(screen.queryByText(i18n.t("Set up your center"))).not.toBeInTheDocument());
  });

  it("D4b — a failed read hides the guide instead of claiming the center is empty", async () => {
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: false, error: { code: "X", message: "denied" } } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);

    renderGuide();

    await waitFor(() => expect(screen.queryByText(i18n.t("Set up your center"))).not.toBeInTheDocument());
  });
});

/* ── E. Trustworthy and complete ─────────────────────────────────────────── */

describe("E — nothing fabricated is presented as evidence", () => {
  const dashboard = readFileSync(resolve(process.cwd(), "src/pages/DashboardPage.tsx"), "utf8");

  it("E1 — no hardcoded trend or percentage badge on any metric tile", () => {
    expect(dashboard).not.toContain('"+0%"');
    expect(dashboard).not.toMatch(/trend=\{/);
    expect(dashboard).not.toMatch(/\btrend\b\s*:\s*string/);
  });

  it("E2 — restricted financial data is labelled restricted, never absent", () => {
    expect(dashboard).toContain('t("Restricted")');
    expect(dashboard).toMatch(/canViewRevenue \? t\("Invoices"\) : t\("Restricted"\)/);
  });

  it("E2b — the dashboard is not described with unearned marketing language", () => {
    expect(dashboard).not.toContain("Intelligence Dashboard");
    expect(dashboard).not.toContain('t("Live Activity")');
    expect(dashboard).toContain('t("Today at your center")');
    expect(dashboard).toContain('t("Recent Activity")');
  });

  it("E3 — no fabricated testimonial, rating or customer name anywhere in src/", () => {
    expect(existsSync(resolve(process.cwd(), "src/pages/LandingPage.tsx"))).toBe(false);

    for (const file of sourceFilesUnder("src")) {
      if (file.startsWith(join("src", "__tests__"))) continue;
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, `${file} must not declare testimonials`).not.toMatch(/\btestimonials\b/);
      expect(source, `${file} must not hardcode a star rating`).not.toMatch(/rating:\s*[1-5]\b/);
    }
  });

  it("E4 — a non-production environment is disclosed, production shows nothing", async () => {
    const { EnvironmentBadge } = await import("../shared/components/EnvironmentBadge");
    await i18n.changeLanguage("ar");

    const original = env.config.environment;
    try {
      (env.config as any).environment = "staging";
      const staging = render(<EnvironmentBadge />);
      expect(screen.getByRole("status")).toHaveTextContent(
        i18n.t("Trial environment — data here is for testing"),
      );
      staging.unmount();

      (env.config as any).environment = "production";
      const production = render(<EnvironmentBadge />);
      expect(screen.queryByRole("status")).toBeNull();
      production.unmount();
    } finally {
      (env.config as any).environment = original;
    }
  });

  it("E5 — index.html declares a description and uses brand tokens only", () => {
    const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
    expect(html).toMatch(/<meta\s+name="description"/);
    expect(html).not.toContain("#1e293b");
    expect(html).not.toContain("#0f172a");
    expect(html).not.toContain("#caa348");
    expect(html).not.toContain("💇‍♀️");
    expect(html).toContain("#8B5CF6");
    expect(html).toContain("/lena-mark.svg");
  });
});

/* ── F. Accessibility, mobile and RTL ────────────────────────────────────── */

describe("F — new surfaces are RTL-safe and touch-safe", () => {
  const newSurfaces = [
    "src/shared/components/GettingStartedCard.tsx",
    "src/shared/components/EnvironmentBadge.tsx",
    "src/pages/LoginPage.tsx",
  ];

  it("F1 — every interactive control in the setup guide meets the 44px minimum", () => {
    const guide = readFileSync(resolve(process.cwd(), "src/shared/components/GettingStartedCard.tsx"), "utf8");
    const buttons = [...guide.matchAll(/<button\b/g)];
    expect(buttons.length).toBeGreaterThan(0);
    for (const match of buttons) {
      const declaration = guide.slice(match.index!, match.index! + 600);
      expect(declaration, "button below 44px").toMatch(/\b(?:min-h-11|h-11|touch-target)\b/);
    }
  });

  it("F2 — uses logical direction properties only", () => {
    const physical = /\b(?:ml|mr|pl|pr)-\d|\btext-(?:left|right)\b|\b(?:left|right)-\d/;
    for (const file of [...newSurfaces, "src/ui/layout/Layout.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, `${file} uses a physical-direction class`).not.toMatch(physical);
    }
  });

  it("F3 — the phone login keeps menu, language and theme as 44px icon controls", () => {
    const login = readFileSync(resolve(process.cwd(), "src/pages/LoginPage.tsx"), "utf8");
    expect(login).toContain("Mobile-only: three compact controls — LENA menu, language and theme");
    expect(login).toContain("onClick={toggleLanguage}");
    expect(login).toContain("onClick={toggleTheme}");
    expect(login).toContain('"inline-flex h-11 w-11 shrink-0');
    expect(login).toContain("<Menu");
    expect(login).toContain("<Globe");
  });

  it("F4 — every retained translation contract resolves in Arabic and English", async () => {
    const keys = [
      "Work email",
      "Trial environment",
      "Development environment",
      "Trial environment — data here is for testing",
      "Set up your center",
      "Follow these steps in order. Each one unlocks the next.",
      "Setup progress",
      "Add your services",
      "Nothing can be booked or sold until your service menu exists.",
      "Add your team",
      "Assign appointments and track who performed each service.",
      "Add your first customer",
      "Keep contact details, history and preferences in one record.",
      "Book your first appointment",
      "Your day view fills up from here.",
      "Record your first sale",
      "Take payment and print the receipt from the point of sale.",
      "Today at your center",
      "Recent Activity",
      "Restricted",
      "Welcome",
      "Dismiss",
      "Catalog & People",
      "Ask your administrator to add the team. You cannot open staff records.",
      "Start with your service menu. Then you can book and sell.",
      "Add products when you start tracking stock.",
    ];

    for (const lang of ["ar", "en"]) {
      await i18n.changeLanguage(lang);
      for (const key of keys) {
        expect(i18n.exists(key), `${lang} missing key: ${key}`).toBe(true);
        expect(i18n.t(key).trim(), `${lang} empty for: ${key}`).not.toBe("");
      }
    }

    await i18n.changeLanguage("ar");
    for (const key of keys) {
      expect(i18n.t(key), `AR resolves to the raw key: ${key}`).not.toBe(key);
    }
  });
});
