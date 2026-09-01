import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
 * Rendered login readout at phone and desktop widths, in both languages.
 * The pre-auth experience intentionally prioritizes brand, clear sign-in and
 * real operating areas over developer/account-provisioning explanations.
 */

function setViewport(width: number) {
  (window as any).innerWidth = width;
  (window as any).innerHeight = width < 768 ? 740 : 900;
  window.dispatchEvent(new Event("resize"));
}

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

afterAll(async () => {
  setViewport(1024);
  await i18n.changeLanguage("ar");
});

describe.each([
  { name: "small phone (360px)", width: 360 },
  { name: "desktop (1280px)", width: 1280 },
])("first-time login readout — $name", ({ width }) => {
  describe.each(["ar", "en"])("in %s", (lang) => {
    beforeEach(async () => {
      vi.restoreAllMocks();
      bootAuthMocks();
      setViewport(width);
      await i18n.changeLanguage(lang);
    });

    it("shows Lena Beauty, the real operating areas and no developer-facing qualification copy", async () => {
      renderLogin();
      const main = await screen.findByRole("main");
      await waitFor(() => expect(within(main).getByLabelText(i18n.t("Work email"))).toBeInTheDocument());

      const visible = main.textContent ?? "";
      expect(visible).toContain("LENA");
      expect(visible).toContain("BEAUTY");

      const labels = lang === "ar"
        ? ["المواعيد", "نقطة البيع", "العملاء", "المخزون", "الموظفون", "التقارير"]
        : ["Appointments", "Point of Sale", "Customers", "Stock", "Staff", "Reports"];
      for (const label of labels) expect(visible).toContain(label);

      for (const unwanted of [
        i18n.t("For the center's team. This is not a customer booking site."),
        i18n.t("Accounts are created by your center administrator. There is no public sign-up."),
        i18n.t("Your data stays in your center's database and is visible only to its team."),
      ]) {
        expect(visible).not.toContain(unwanted);
      }
    });

    it("keeps sign-in as the single primary action", async () => {
      renderLogin();
      const main = await screen.findByRole("main");
      await waitFor(() => expect(within(main).getByLabelText(i18n.t("Work email"))).toBeInTheDocument());

      const submits = within(main).getAllByRole("button").filter(
        (b) => (b as HTMLButtonElement).type === "submit",
      );
      expect(submits).toHaveLength(1);
      expect(submits[0]).toHaveTextContent(i18n.t("Sign In"));
    });

    it("never promises a capability the product denies by default", async () => {
      renderLogin();
      const main = await screen.findByRole("main");
      await waitFor(() => expect(within(main).getByLabelText(i18n.t("Work email"))).toBeInTheDocument());

      const visible = (main.textContent ?? "").toLowerCase();
      for (const claim of ["client portal", "online booking", "book now", "offline", "بوابة العميلات", "حجز أونلاين"]) {
        expect(visible, `pre-auth text must not promise "${claim}"`).not.toContain(claim.toLowerCase());
      }
    });
  });
});

describe.each([
  { name: "small phone (360px)", width: 360 },
  { name: "desktop (1280px)", width: 1280 },
])("first-run guidance — $name", ({ width }) => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    setViewport(width);
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  it("tells an empty center exactly what to do first, in dependency order", async () => {
    render(
      <MemoryRouter>
        <GettingStartedCard />
      </MemoryRouter>,
    );

    const guide = await screen.findByRole("region", { name: i18n.t("Set up your center") });
    const steps = within(guide).getAllByRole("listitem");

    expect(steps.map((s) => s.textContent)).toEqual([
      expect.stringContaining(i18n.t("Add your services")),
      expect.stringContaining(i18n.t("Add your team")),
      expect.stringContaining(i18n.t("Add your first customer")),
      expect.stringContaining(i18n.t("Book your first appointment")),
      expect.stringContaining(i18n.t("Record your first sale")),
    ]);

    expect(steps[0].textContent).toContain(
      i18n.t("Nothing can be booked or sold until your service menu exists."),
    );

    const progress = within(guide).getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "5");
  });

  it("advances real progress as the center fills in, without faking later steps", async () => {
    vi.mocked(useCases.services.list).mockResolvedValue({ ok: true, data: [{ id: "s1" }] } as any);

    render(
      <MemoryRouter>
        <GettingStartedCard />
      </MemoryRouter>,
    );

    const guide = await screen.findByRole("region", { name: i18n.t("Set up your center") });
    await waitFor(() =>
      expect(within(guide).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1"),
    );

    const steps = within(guide).getAllByRole("listitem");
    expect(steps[4].textContent).toContain(i18n.t("Take payment and print the receipt from the point of sale."));
  });
});
