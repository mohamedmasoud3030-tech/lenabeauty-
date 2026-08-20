/**
 * Help system tests:
 * - Article registry freshness & content quality
 * - Search behavior in both languages
 * - Deep-link resolution
 * - Support intake validation (no secrets, required fields, limits)
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  HELP_ARTICLES,
  getHelpArticle,
  searchHelpArticles,
  HELP_CATEGORY_LABELS,
} from "../shared/help/articles";
import HelpCenterPage from "../pages/HelpCenterPage";
import { useCases } from "../app/composition/useCases";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

/** Shared render helper for the Help Center page. */
function renderHelp(initialEntry = "/help") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ToastProvider>
        <Routes>
          <Route path="/help" element={<HelpCenterPage />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("help article registry", () => {
  it("contains a known verified set of articles", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug).sort();
    expect(slugs).toEqual([
      "backup-export",
      "book-appointment",
      "error-codes",
      "first-login",
      "forgot-password",
      "manage-customers",
      "offline",
      "payment-gateway",
      "permissions",
      "set-up-services",
      "take-payment",
      "whatsapp-notifications",
    ]);
  });

  it("every article has non-empty bilingual title and body", () => {
    for (const article of HELP_ARTICLES) {
      expect(article.title.ar.length).toBeGreaterThan(3);
      expect(article.title.en.length).toBeGreaterThan(3);
      expect(article.body.ar.length).toBeGreaterThan(0);
      expect(article.body.en.length).toBeGreaterThan(0);
      // Bodies should have at least one real sentence
      for (const p of [...article.body.ar, ...article.body.en]) {
        expect(p.length).toBeGreaterThan(20);
      }
    }
  });

  it("every slug resolves uniquely", () => {
    const seen = new Set<string>();
    for (const a of HELP_ARTICLES) {
      expect(seen.has(a.slug)).toBe(false);
      seen.add(a.slug);
    }
  });

  it("every category has a bilingual label", () => {
    for (const category of Object.keys(HELP_CATEGORY_LABELS)) {
      expect(HELP_CATEGORY_LABELS[category as keyof typeof HELP_CATEGORY_LABELS].ar.length).toBeGreaterThan(0);
      expect(HELP_CATEGORY_LABELS[category as keyof typeof HELP_CATEGORY_LABELS].en.length).toBeGreaterThan(0);
    }
  });

  it("does not promise features that are not implemented", () => {
    const allText = HELP_ARTICLES.flatMap((a) => [...a.body.en]).join(" ").toLowerCase();
    // These are NOT shipped as capabilities — the articles must never state
    // them as available (they may truthfully state their absence).
    const positiveClaims = [
      "supports live payment",
      "enables live payment",
      "automated sms delivery",
      "cloud backup restore",
      "automated whatsapp delivery",
      "sign up for an account",
    ];
    for (const claim of positiveClaims) {
      expect(allText).not.toContain(claim);
    }
    // The absence statements must exist so users are not misled.
    expect(allText).toContain("no live payment session");
    expect(allText).toContain("restore is deliberately disabled");
    expect(allText).toContain("no automatic delivery receipt");
  });
});

describe("help search", () => {
  it("finds articles by English keyword", async () => {
    await i18n.changeLanguage("en");
    const results = searchHelpArticles("password", "en");
    expect(results.some((a) => a.slug === "forgot-password")).toBe(true);
  });

  it("finds articles by Arabic keyword", async () => {
    await i18n.changeLanguage("ar");
    const results = searchHelpArticles("كلمة المرور", "ar");
    expect(results.some((a) => a.slug === "forgot-password")).toBe(true);
  });

  it("returns all articles for an empty query", () => {
    expect(searchHelpArticles("", "en")).toHaveLength(HELP_ARTICLES.length);
  });
});

describe("help deep links", () => {
  it("resolves a valid slug", () => {
    expect(getHelpArticle("take-payment")?.slug).toBe("take-payment");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getHelpArticle("not-a-real-article")).toBeUndefined();
  });
});

describe("HelpCenterPage render", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.help, "createTicket").mockResolvedValue({
      ok: true,
      data: { id: "t1", centerId: "c1", createdById: "u1", urgency: "normal", status: "NEW", createdAt: new Date() },
    } as any);
  });

  it("lists articles for a staff user", async () => {
    renderHelp();
    expect(await screen.findByText("Help Center")).toBeInTheDocument();
    expect(screen.getByText("First login and your role")).toBeInTheDocument();
  });

  it("opens an article from a deep link", async () => {
    renderHelp("/help?help=permissions");
    expect(await screen.findByText("Who can see what")).toBeInTheDocument();
    expect(screen.getByText(/Only ADMIN can open Employees/i)).toBeInTheDocument();
  });

  it("filters articles by search", async () => {
    renderHelp();
    await screen.findByText("Help Center");
    const search = screen.getByLabelText("Search help articles");
    fireEvent.change(search, { target: { value: "password" } });
    await waitFor(() => {
      expect(screen.getByText("Reset your password")).toBeInTheDocument();
      expect(screen.queryByText("Booking an appointment")).not.toBeInTheDocument();
    });
  });
});

describe("support intake validation", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.help, "createTicket").mockResolvedValue({
      ok: true,
      data: { id: "t1", centerId: "c1", createdById: "u1", urgency: "normal", status: "NEW", createdAt: new Date() },
    } as any);
  });

  async function renderIntake() {
    renderHelp();
    await screen.findByText("Help Center");
    fireEvent.click(screen.getByText("Contact support"));
    await screen.findByText("Report a problem");
  }

  it("rejects a ticket that contains a secret pattern", async () => {
    await renderIntake();
    fireEvent.change(screen.getByLabelText("What did you expect?"), { target: { value: "it should save my password" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit ticket/i }));
    expect(await screen.findByText("Do not include passwords, tokens, or payment details.")).toBeInTheDocument();
  });

  it("rejects a ticket with no description", async () => {
    await renderIntake();
    fireEvent.click(screen.getByRole("button", { name: /Submit ticket/i }));
    expect(await screen.findByText("Describe the expected or actual behavior.")).toBeInTheDocument();
  });

  it("submits a valid ticket and calls the RPC", async () => {
    await renderIntake();
    const createSpy = vi.spyOn(useCases.help, "createTicket");
    fireEvent.change(screen.getByLabelText("What did you expect?"), { target: { value: "The sale should record" } });
    fireEvent.change(screen.getByLabelText("What happened instead?"), { target: { value: "It shows an error" } });
    fireEvent.click(screen.getByRole("button", { name: /Submit ticket/i }));
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    const payload = createSpy.mock.calls[0][0];
    expect(payload.expectedBehavior).toBe("The sale should record");
    expect(payload.actualBehavior).toBe("It shows an error");
    expect(payload.environment).toBeDefined();
  });

  it("prefills route from the current hash", async () => {
    renderHelp();
    await screen.findByText("Help Center");
    fireEvent.click(screen.getByText("Contact support"));
    expect(await screen.findByText("/help")).toBeInTheDocument();
  });
});
