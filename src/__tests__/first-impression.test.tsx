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
 * Encodes the measurable criteria in FIRST_IMPRESSION_REVIEW.md §7: a
 * first-time user must be able to explain what the product is, who it is for,
 * where the single primary action is, and what happens next — and must never
 * be shown fabricated proof, an invented metric, or a hidden environment.
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

/* ── A. Can a first-time user explain the product? ───────────────────────── */

describe("A — the pre-auth screen explains what the product is", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    bootAuthMocks();
    await i18n.changeLanguage("ar");
  });

  it("A1 — names the product category and the unit of business", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("The daily operations system for one beauty center.")),
      ).toBeInTheDocument(),
    );
  });

  it("A2 — names the concrete capabilities that actually ship", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("Appointments, point of sale, customers, stock and staff — in one place.")),
      ).toBeInTheDocument(),
    );
  });

  it("A3 — promises no deny-by-default capability before sign-in", () => {
    const login = readFileSync(resolve(process.cwd(), "src/pages/LoginPage.tsx"), "utf8");
    for (const forbidden of ["Book Now", "Online Booking", "Client Portal", "Open App", "Desktop-Ready", "offline-ready"]) {
      expect(login, `login must not advertise "${forbidden}"`).not.toContain(forbidden);
    }
  });
});

/* ── B. Can they identify who it is for? ─────────────────────────────────── */

describe("B — the pre-auth screen identifies its audience", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    bootAuthMocks();
    await i18n.changeLanguage("ar");
  });

  it("B1/B2 — states it is for the center's team and not a customer booking site", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("For the center's team. This is not a customer booking site.")),
      ).toBeInTheDocument(),
    );
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

    // The adapter authenticates with an email; the UI must not ask for a username.
    const adapter = readFileSync(resolve(process.cwd(), "src/infrastructure/supabase/repositories.ts"), "utf8");
    expect(adapter).toContain("signInWithPassword({");
    expect(adapter).toContain("email: username");
  });

  it("C2b — the field explains the exact credential format expected", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("Use the work email your administrator registered for you.")),
      ).toBeInTheDocument(),
    );
  });

  it("C3 — no competing pre-auth call to action", async () => {
    renderLogin();
    await waitFor(() => expect(screen.getByLabelText(i18n.t("Work email"))).toBeInTheDocument());
    // Language and theme controls are preferences, not CTAs; no navigation
    // button may compete with signing in.
    expect(screen.queryByRole("link")).toBeNull();
  });
});

/* ── D. Do they understand what happens next? ────────────────────────────── */

describe("D — the user knows what happens next", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    bootAuthMocks();
    await i18n.changeLanguage("ar");
  });

  it("D1 — states where signing in lands the user", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("After signing in you land on today's work: appointments, sales and stock alerts.")),
      ).toBeInTheDocument(),
    );
  });

  it("D2 — a user without an account is told how accounts are issued", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("Accounts are created by your center administrator. There is no public sign-up.")),
      ).toBeInTheDocument(),
    );
  });

  it("D2b — privacy is reassured at the moment credentials are requested", async () => {
    renderLogin();
    await waitFor(() =>
      expect(
        screen.getByText(i18n.t("Your data stays in your center's database and is visible only to its team.")),
      ).toBeInTheDocument(),
    );
  });
});

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
    // Dependency order is the product truth: nothing sells before services.
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
    // The former navy splash, off-brand gold theme-color and emoji placeholder
    // all made the product look like an unfinished template.
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

  it("F2 — uses logical direction properties only", () => {
    const physical = /\b(?:ml|mr|pl|pr)-\d|\btext-(?:left|right)\b|\b(?:left|right)-\d/;
    for (const file of [...newSurfaces, "src/ui/layout/Layout.tsx"]) {
      const source = readFileSync(resolve(process.cwd(), file), "utf8");
      expect(source, `${file} uses a physical-direction class`).not.toMatch(physical);
    }
  });

  it("F1 — every interactive control in the setup guide meets the 44px minimum", () => {
    const guide = readFileSync(resolve(process.cwd(), "src/shared/components/GettingStartedCard.tsx"), "utf8");
    const buttons = [...guide.matchAll(/<button\b/g)];
    expect(buttons.length).toBeGreaterThan(0);
    for (const match of buttons) {
      // An arrow function inside a prop makes a non-greedy "up to >" match
      // unreliable, so inspect the declaration window after the tag opens.
      const declaration = guide.slice(match.index!, match.index! + 600);
      expect(declaration, "button below 44px").toMatch(/\b(?:min-h-11|h-11|touch-target)\b/);
    }
  });

  it("F3 — every new key resolves in both Arabic and English", async () => {
    const keys = [
      "The daily operations system for one beauty center.",
      "Appointments, point of sale, customers, stock and staff — in one place.",
      "For the center's team. This is not a customer booking site.",
      "After signing in you land on today's work: appointments, sales and stock alerts.",
      "Accounts are created by your center administrator. There is no public sign-up.",
      "Your data stays in your center's database and is visible only to its team.",
      "Work email",
      "Use the work email your administrator registered for you.",
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

    // Arabic must be a real translation, not the English key echoed back.
    await i18n.changeLanguage("ar");
    for (const key of keys) {
      expect(i18n.t(key), `AR resolves to the raw key: ${key}`).not.toBe(key);
    }
  });
});
