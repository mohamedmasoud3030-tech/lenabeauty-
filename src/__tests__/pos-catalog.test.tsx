import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

/**
 * POS catalog loading contracts: only sellable lines reach the cart
 * (active + finite positive price), packages are normalized from
 * `packagePrice` to `price`, and soft-failures (packages / settings / gift
 * cards) degrade to empty state instead of breaking the whole catalog.
 */

const h = vi.hoisted(() => ({
  calls: {
    services: vi.fn(),
    products: vi.fn(),
    packages: vi.fn(),
    employees: vi.fn(),
    settings: vi.fn(),
    giftCards: vi.fn(),
  },
}));

vi.mock("../app/composition/useCases", () => ({
  useCases: {
    services: { list: h.calls.services },
    products: { list: h.calls.products },
    servicePackages: { list: h.calls.packages },
    employees: { list: h.calls.employees },
    settings: { get: h.calls.settings },
    giftCards: { list: h.calls.giftCards },
  },
}));

import { usePosCatalog } from "../pages/pos/usePosCatalog";

const ok = (data: unknown) => ({ ok: true, data });

function stubHappyPath() {
  h.calls.services.mockResolvedValue(ok([
    { id: "s1", name: "Active", price: 20, isActive: true },
    { id: "s2", name: "Disabled", price: 30, isActive: false },
    { id: "s3", name: "Free", price: 0, isActive: true },
    { id: "s4", name: "Broken", price: Number.NaN, isActive: true },
  ]));
  h.calls.products.mockResolvedValue(ok([
    { id: "p1", name: "Product", price: 5, isActive: true },
    { id: "p2", name: "Disabled product", price: 9, isActive: false },
  ]));
  h.calls.packages.mockResolvedValue(ok([
    { id: "pk1", name: "Package A", packagePrice: "15", isActive: true },
    { id: "pk2", name: "Package B", packagePrice: 0, isActive: true },
    { id: "pk3", name: "Package C", packagePrice: 25, isActive: false },
  ]));
  h.calls.employees.mockResolvedValue(ok([
    { id: "e1", name: "Active staff", isActive: true },
    { id: "e2", name: "Disabled staff", isActive: false },
  ]));
  h.calls.settings.mockResolvedValue(ok({ taxRate: 14 }));
  h.calls.giftCards.mockResolvedValue(ok([
    { id: "g1", code: "G1", isActive: true },
    { id: "g2", code: "G2", isActive: false },
  ]));
}

beforeEach(() => {
  Object.values(h.calls).forEach((fn) => fn.mockReset());
  stubHappyPath();
});

describe("usePosCatalog", () => {
  it("only exposes sellable lines and normalizes package pricing", async () => {
    const { result } = renderHook(() => usePosCatalog());
    await act(async () => {
      await result.current.loadData();
    });

    expect(result.current.services.map((s) => s.id)).toEqual(["s1"]);
    expect(result.current.products.map((p) => p.id)).toEqual(["p1"]);
    // "15" (string) becomes a real number, and the package is exposed as `price`.
    expect(result.current.packages).toEqual([
      expect.objectContaining({ id: "pk1", price: 15, packagePrice: "15" }),
    ]);
    expect(result.current.employees.map((e) => e.id)).toEqual(["e1"]);
    expect(result.current.giftCards.map((g) => g.id)).toEqual(["g1"]);
    expect(result.current.taxRate).toBe(14);
    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it("tax rate defaults to 0 when settings are missing", async () => {
    h.calls.settings.mockResolvedValue(ok(null));
    const { result } = renderHook(() => usePosCatalog());
    await act(async () => {
      await result.current.loadData();
    });
    expect(result.current.taxRate).toBe(0);
  });

  it("soft failures (packages / settings / gift cards) degrade to empty, not fatal", async () => {
    h.calls.packages.mockRejectedValue(new Error("packages down"));
    h.calls.settings.mockRejectedValue(new Error("settings down"));
    h.calls.giftCards.mockRejectedValue(new Error("cards down"));
    const { result } = renderHook(() => usePosCatalog());
    await act(async () => {
      await result.current.loadData();
    });
    expect(result.current.loadError).toBeNull();
    expect(result.current.packages).toEqual([]);
    expect(result.current.giftCards).toEqual([]);
    expect(result.current.taxRate).toBe(0);
    // Core catalog still loads.
    expect(result.current.services.map((s) => s.id)).toEqual(["s1"]);
  });

  it("a failed core load surfaces a formatted error and stops cleanly", async () => {
    h.calls.services.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => usePosCatalog());
    await act(async () => {
      await result.current.loadData();
    });
    expect(result.current.loadError).toBe("boom");
    expect(result.current.loading).toBe(false);
    expect(result.current.services).toEqual([]);
  });
});
