import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyKeyboardInset,
  clearKeyboardInset,
  KEYBOARD_OPEN_THRESHOLD,
  measureKeyboardInset,
} from "../shared/hooks/useKeyboardInset";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const customers = readFileSync(resolve(process.cwd(), "src/pages/CustomersPage.tsx"), "utf8");
const appointments = readFileSync(resolve(process.cwd(), "src/pages/AppointmentsPage.tsx"), "utf8");
const pos = readFileSync(resolve(process.cwd(), "src/pages/PosInvoicesPage.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "src/ui/layout/Layout.tsx"), "utf8");
const receipt = readFileSync(resolve(process.cwd(), "src/shared/components/ReceiptPreviewModal.tsx"), "utf8");
const modal = readFileSync(resolve(process.cwd(), "src/shared/components/Modal.tsx"), "utf8");

describe("small-phone portrait UX contracts", () => {
  it("does not ship an Android-style touch ripple", () => {
    expect(css).not.toContain(".touch-feedback");
    expect(css).not.toMatch(/ripple effect/i);
    expect(css).not.toContain("radial-gradient(circle, currentColor");
  });

  it("clips page-level horizontal overflow and keeps 16px inputs on small phones", () => {
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("overscroll-behavior-x: none");
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*font-size: 16px/);
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain(".above-bottom-nav");
  });

  it("hides the bottom nav while the keyboard is open", () => {
    expect(layout).toContain("useKeyboardInset");
    expect(layout).toContain("useScrollFieldIntoView");
    expect(layout).toContain("isKeyboardOpen");
    expect(layout).toContain("translate-y-full");
  });

  it("filters admin-only destinations from the mobile More menu", () => {
    expect(layout).toContain('{ to: "/reports", labelKey: "Reports", Icon: BarChart3, adminOnly: true }');
    expect(layout).toContain('{ to: "/employees", labelKey: "Employees", Icon: Users, adminOnly: true }');
    expect(layout).toContain('{ to: "/settings", labelKey: "Settings", Icon: Settings2, adminOnly: true }');
    expect(layout).toContain("visibleMoreMenuItems.map");
  });

  it("does not implement swipe actions on Customers (accidental delete risk)", () => {
    expect(customers).not.toMatch(/onTouchStart|onTouchEnd|onPan|drag=["']x["']/);
    expect(customers).not.toMatch(/swipe actions/i);
    expect(customers).toContain("No swipe");
    expect(customers).toContain("aria-label={t(\"Actions\")}");
    expect(customers).toContain("openEdit(c)");
    expect(customers).not.toContain("handleDeleteCustomer");
    expect(customers).not.toContain("useCases.customers.delete");
  });

  it("defaults Appointments to day mode on a phone-sized viewport", () => {
    expect(appointments).toContain("window.innerWidth < 1024 ? \"day\" : \"week\"");
    expect(appointments).toContain("skip empty days");
    expect(appointments).toContain("above-bottom-nav");
    expect(appointments).toContain("<Modal");
    expect(modal).toContain("--keyboard-inset");
  });

  it("keeps a single POS category strip and a thumb-zone pay action", () => {
    expect(pos.match(/mobile-scroll-x/g) ?? []).toHaveLength(0);
    expect(pos).toContain("no duplicate category row");
    expect(pos).toContain("Complete Payment");
    expect(pos).toContain("above-bottom-nav");
    expect(pos).toContain("Catalog");
    expect(pos).toContain("Cart");
  });

  it("keeps receipt share / print / save as 44px targets", () => {
    expect(receipt).toContain("handleShare");
    expect(receipt).toContain("t(\"Share\")");
    expect(receipt).toContain("touch-target");
    expect(receipt).toContain("window.print");
  });
});

describe("keyboard inset measurement", () => {
  afterEach(() => {
    clearKeyboardInset();
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  });

  it("returns 0 when visualViewport is missing", () => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
    expect(measureKeyboardInset()).toBe(0);
  });

  it("publishes --keyboard-inset and .keyboard-open from the covered viewport", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 640 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height: 360, offsetTop: 0 },
    });

    const inset = measureKeyboardInset();
    expect(inset).toBe(280);
    expect(inset).toBeGreaterThan(KEYBOARD_OPEN_THRESHOLD);

    applyKeyboardInset(inset);
    expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("280px");
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(true);

    clearKeyboardInset();
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(false);
  });
});
