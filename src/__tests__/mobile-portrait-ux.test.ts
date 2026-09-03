import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NAV_DESTINATIONS, visibleDestinations } from "../app/navigation";
import {
  applyKeyboardInset,
  clearKeyboardInset,
  KEYBOARD_OPEN_THRESHOLD,
  measureKeyboardInset,
} from "../shared/hooks/useKeyboardInset";

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const customers = readFileSync(resolve(process.cwd(), "src/pages/CustomersPage.tsx"), "utf8");
const appointments = readFileSync(resolve(process.cwd(), "src/pages/AppointmentsPage.tsx"), "utf8");
const appointmentsSchedule = readFileSync(resolve(process.cwd(), "src/pages/appointments/AppointmentsSchedule.tsx"), "utf8");
const bookingDialog = readFileSync(resolve(process.cwd(), "src/pages/appointments/AppointmentBookingDialog.tsx"), "utf8");
const pos = readFileSync(resolve(process.cwd(), "src/pages/PosInvoicesPage.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "src/ui/layout/Layout.tsx"), "utf8");
const mobileDock = readFileSync(resolve(process.cwd(), "src/ui/layout/MobileActionDock.tsx"), "utf8");
const mobileSheet = readFileSync(resolve(process.cwd(), "src/ui/layout/MobileNavigationSheet.tsx"), "utf8");
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

  it("hides the compact mobile dock while the keyboard is open", () => {
    expect(layout).toContain("useKeyboardInset");
    expect(layout).toContain("useScrollFieldIntoView");
    expect(layout).toContain("isKeyboardOpen");
    expect(mobileDock).toContain("isKeyboardOpen");
    expect(mobileDock).toContain("translate-y-[calc(100%+2rem)]");
  });

  it("uses a bottom navigation sheet instead of a mobile sidebar or destination bar", () => {
    expect(layout).toContain('<div id="app-sidebar" className="hidden h-screen print:hidden lg:block">');
    expect(layout).toContain("<MobileNavigationSheet");
    expect(mobileSheet).toContain('id="mobile-navigation-sheet"');
    expect(mobileSheet).toContain("data-mobile-nav-sheet");
    expect(mobileSheet).toContain('initial={{ y: "100%" }}');
    expect(mobileSheet).toContain("visibleDestinations");
    expect(mobileSheet).toContain('isAdmin: me?.role === "ADMIN"');
  });

  it("keeps the mobile dock icon-only and removes the fake notification shortcut", () => {
    expect(mobileDock).toContain("<Menu");
    expect(mobileDock).toContain("<GlobalSearch");
    expect(mobileDock).toContain("<Plus");
    expect(mobileDock).not.toContain("<span");
    expect(layout).not.toContain("Bell");
    expect(layout).not.toContain('nav("/settings?tab=notifications")');
  });

  it("filters admin-only destinations from the mobile navigation sheet", () => {
    expect(mobileSheet).toContain("visibleDestinations");
    expect(mobileSheet).toContain('isAdmin: me?.role === "ADMIN"');

    const staffVisible = visibleDestinations({
      isAdmin: false,
      optionalModules: { giftCards: true, packages: true },
    });
    expect(staffVisible.every((d) => !d.adminOnly)).toBe(true);

    for (const path of ["/reports", "/employees", "/settings"]) {
      const destination = NAV_DESTINATIONS.find((d) => d.path === path);
      expect(destination, `${path} must exist in the registry`).toBeDefined();
      expect(destination!.adminOnly, `${path} must be admin-only`).toBe(true);
      expect(staffVisible.some((d) => d.path === path)).toBe(false);
    }
  });

  it("does not implement gesture-driven customer actions (accidental delete risk)", () => {
    expect(customers).not.toMatch(/onTouchStart|onTouchEnd|onPan|drag=["']x["']/);
    expect(customers).toContain("No swipe");
    expect(customers).toContain("aria-label={t(\"Actions\")}");
    expect(customers).toMatch(/openEdit\([^)]*\)/);
    expect(customers).not.toContain("handleDeleteCustomer");
    expect(customers).not.toContain("useCases.customers.delete");
  });

  it("defaults Appointments to day mode on a phone-sized viewport", () => {
    expect(appointments).toContain("window.innerWidth < 1024 ? \"day\" : \"week\"");
    expect(appointmentsSchedule).toContain("window.innerWidth >= 1024");
    expect(appointmentsSchedule).toContain("above-bottom-nav");
    expect(bookingDialog).toContain("<Modal");
    expect(modal).toContain("--keyboard-inset");
  });

  it("keeps a single POS category strip and a thumb-zone pay action", () => {
    expect(pos.match(/mobile-scroll-x/g) ?? []).toHaveLength(0);
    expect(pos).toContain("no duplicate category row");
    expect(pos).toContain("Record completed sale");
    expect(pos).toContain("no card is charged here");
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
    expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe("0px");
    expect(document.documentElement.classList.contains("keyboard-open")).toBe(false);
  });
});
