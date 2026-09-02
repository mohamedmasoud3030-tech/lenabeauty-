import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCases } from "../app/composition/useCases";
import { NO_OPTIONAL_MODULES, resolveOptionalModules, useOptionalModules } from "../shared/hooks/useOptionalModules";
import { useInView } from "../shared/hooks/useInView";

/**
 * Round 2 Phase 14 — consolidated shared owners.
 *
 * Two genuine duplications were collapsed into one owner each:
 *
 *  1. Optional-module availability was resolved by a byte-identical effect in
 *     BOTH ui/layout/Layout.tsx and ui/layout/Sidebar.tsx. Layout renders
 *     Sidebar, so giftCards.list() and servicePackages.list() each fired TWICE
 *     on every authenticated page load, and the two surfaces could in
 *     principle disagree about which modules exist.
 *  2. The lazy-load IntersectionObserver effect existed twice (LazyChart had a
 *     local useInView, LazyImage inlined its own copy).
 *
 * These tests pin the single-owner property and the observable behavior, so the
 * duplication cannot quietly come back.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, out);
    } else out.push(full);
  }
  return out;
}

/** The repository Result type is structural; tests only need ok/data/error. */
const some = (data: unknown) => Promise.resolve({ ok: true, data }) as never;
const none = () => Promise.resolve({ ok: false, error: { message: "down" } }) as never;

describe("optional-module availability has one owner", () => {
  let giftCards: ReturnType<typeof vi.spyOn>;
  let packages: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    giftCards = vi.spyOn(useCases.giftCards, "list");
    packages = vi.spyOn(useCases.servicePackages, "list");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves once for concurrent consumers instead of once per surface", async () => {
    giftCards.mockImplementation(() => some([{ id: "gc-1" }]));
    packages.mockImplementation(() => some([{ id: "pkg-1" }]));

    // Layout and Sidebar mount together; both call the same hook.
    const first = renderHook(() => useOptionalModules());
    const second = renderHook(() => useOptionalModules());

    await waitFor(() => expect(first.result.current.giftCards).toBe(true));
    await waitFor(() => expect(second.result.current.giftCards).toBe(true));

    expect(giftCards).toHaveBeenCalledTimes(1);
    expect(packages).toHaveBeenCalledTimes(1);
    // Both surfaces must agree — that is the whole point of one owner.
    expect(second.result.current).toEqual(first.result.current);
    expect(first.result.current).toEqual({ giftCards: true, packages: true });
  });

  it("hides a module the center has no data for", async () => {
    giftCards.mockImplementation(() => some([{ id: "gc-1" }]));
    packages.mockImplementation(() => some([]));

    const { result } = renderHook(() => useOptionalModules());
    await waitFor(() => expect(result.current.giftCards).toBe(true));

    expect(result.current).toEqual({ giftCards: true, packages: false });
  });

  it("fails closed: an unreadable module stays hidden rather than throwing", async () => {
    giftCards.mockImplementation(() => none());
    packages.mockImplementation(() => Promise.reject(new Error("network down")) as never);

    const { result } = renderHook(() => useOptionalModules());

    await waitFor(() => expect(result.current).toEqual(NO_OPTIONAL_MODULES));
    expect(giftCards).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent reads but is not a cache", async () => {
    giftCards.mockImplementation(() => some([{ id: "gc-1" }]));
    packages.mockImplementation(() => some([{ id: "pkg-1" }]));

    await resolveOptionalModules();
    expect(giftCards).toHaveBeenCalledTimes(1);

    // A later mount re-reads current data, exactly as the old effects did.
    const later = renderHook(() => useOptionalModules());
    await waitFor(() => expect(later.result.current.giftCards).toBe(true));
    expect(giftCards).toHaveBeenCalledTimes(2);
  });
});

describe("lazy-load viewport detection has one owner", () => {
  it("is the only module that constructs an IntersectionObserver", () => {
    const root = resolve(process.cwd(), "src");
    const owners = walk(root)
      .filter((file) => /\.(tsx?|jsx?)$/.test(file))
      .filter((file) => !file.includes(join("src", "__tests__")))
      .filter((file) => readFileSync(file, "utf8").includes("new IntersectionObserver"))
      .map((file) => file.slice(root.length + 1).split("\\").join("/"));

    expect(owners).toEqual(["shared/hooks/useInView.ts"]);
  });

  it("is consumed by both lazy surfaces", () => {
    const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
    for (const file of ["src/shared/components/LazyChart.tsx", "src/shared/components/LazyImage.tsx"]) {
      expect(read(file), file).toContain('from "../hooks/useInView"');
      expect(read(file), file).not.toContain("new IntersectionObserver");
    }
  });

  it("flips to visible when the element is observed and stays visible", async () => {
    // setupTests polyfills IntersectionObserver to report intersection as soon
    // as an element is observed, which is what a mounted element experiences.
    function Probe() {
      const [ref, inView] = useInView<HTMLDivElement>();
      return <div ref={ref}>{inView ? "visible" : "hidden"}</div>;
    }

    const { rerender } = render(<Probe />);
    await waitFor(() => expect(screen.getByText("visible")).toBeInTheDocument());

    // Scrolling away must never un-load content that already rendered.
    rerender(<Probe />);
    expect(screen.getByText("visible")).toBeInTheDocument();
  });
});
