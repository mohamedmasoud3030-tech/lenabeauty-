import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GettingStartedCard } from "../shared/components/GettingStartedCard";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

/**
 * Resilience contracts for the first-run onboarding card.
 *
 * The card runs three repository reads on mount, persists a dismissal
 * preference, and can be unmounted mid-flight by route changes. Each of those
 * is a real failure mode on a shared salon device:
 *   - a repository that rejects (network/authorization) must hide the card
 *     rather than claim the center is empty;
 *   - localStorage can throw in private mode or when the quota is exhausted;
 *   - navigating away before the reads settle must not update a dead tree.
 */
describe("first-run onboarding resilience", () => {
  beforeEach(async () => { vi.restoreAllMocks(); localStorage.clear(); await i18n.changeLanguage("ar"); });

  it("does not crash when a repository throws instead of returning Result", async () => {
    vi.spyOn(useCases.services, "list").mockRejectedValue(new Error("boom"));
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    render(<MemoryRouter><GettingStartedCard /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByRole("region")).not.toBeInTheDocument());
  });

  it("survives localStorage being unavailable (private mode / quota)", async () => {
    const orig = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: { getItem(){throw new Error("denied");}, setItem(){throw new Error("denied");}, removeItem(){throw new Error("denied");} },
    });
    try {
      vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] } as any);
      vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
      vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
      render(<MemoryRouter><GettingStartedCard /></MemoryRouter>);
      expect(await screen.findByRole("region")).toBeInTheDocument();
    } finally {
      if (orig) Object.defineProperty(window, "localStorage", orig);
    }
  });

  it("unmounts cleanly without setting state after teardown", async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...a) => { errors.push(a); });
    let resolveFn: (v:any)=>void = () => {};
    vi.spyOn(useCases.services, "list").mockReturnValue(new Promise(r => { resolveFn = r; }) as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    const { unmount } = render(<MemoryRouter><GettingStartedCard /></MemoryRouter>);
    unmount();
    resolveFn({ ok: true, data: [] });
    await new Promise(r => setTimeout(r, 30));
    const bad = errors.filter(e => String(e).includes("unmounted") || String(e).includes("not wrapped in act"));
    expect(bad).toEqual([]);
    spy.mockRestore();
  });
});
