import { describe, it, expect } from "vitest";

import { can, UserRole } from "../domain/entities/Session";
import { mapErrorToMessage } from "../application/errors/ErrorMapper";
import { validateCheckoutPayload } from "../application/dto";

describe("Authorization Rules", () => {
  it("Admin should be able to view revenue", () => {
    const session = {
      status: "authenticated" as const,
      session: {
        user: { id: "1", username: "admin", role: UserRole.ADMIN }
      }
    };
    expect(can(session, "revenue.view")).toBe(true);
  });

  it("Staff should not be able to view settings", () => {
    const session = {
      status: "authenticated" as const,
      session: {
        user: { id: "2", username: "staff", role: UserRole.STAFF }
      }
    };
    expect(can(session, "settings.view")).toBe(false);
  });

  it("Anonymous users cannot view settings", () => {
    expect(can({ status: "anonymous" }, "settings.view")).toBe(false);
  });

  it("Manager cannot access admin-only sections (must match RequireAdmin)", () => {
    const session = {
      status: "authenticated" as const,
      session: {
        user: { id: "3", username: "manager", role: UserRole.MANAGER }
      }
    };
    // Admin-only sections are guarded by RequireAdmin (ADMIN only).
    expect(can(session, "settings.view")).toBe(false);
    expect(can(session, "settings.update")).toBe(false);
    expect(can(session, "reports.view")).toBe(false);
    // But managers keep operational permissions.
    expect(can(session, "pos.checkout")).toBe(true);
    expect(can(session, "customers.create")).toBe(true);
  });
});

describe("Error Mapping", () => {
  it("Maps INVALID_CREDENTIALS to a stable i18n key", () => {
    const key = mapErrorToMessage({ code: "INVALID_CREDENTIALS" });
    expect(key).toBe("error.invalid_credentials");
  });

  it("Resolves the key via a provided translate function", () => {
    const t = (k: string) => (k === "error.invalid_credentials" ? "بيانات الاعتماد غير صحيحة." : k);
    const message = mapErrorToMessage({ code: "INVALID_CREDENTIALS" }, t);
    expect(message).toBe("بيانات الاعتماد غير صحيحة.");
  });

  it("Falls back to the raw message when code is unknown", () => {
    const message = mapErrorToMessage({ code: "UNKNOWN_ERROR", message: "foo" });
    expect(message).toBe("foo");
  });
});

describe("Checkout Payload Validation", () => {
  it("Should reject undefined or empty payloads", () => {
    const errors = validateCheckoutPayload(null);
    expect(errors).toContain("Payload is required");
  });

  it("Should reject payloads missing customerId", () => {
    const errors = validateCheckoutPayload({ items: [] });
    expect(errors).toContain("Customer details are missing");
  });

  it("Should reject empty items list", () => {
    const errors = validateCheckoutPayload({ customerId: "cust-1", items: [] });
    expect(errors).toContain("Cart must not be empty");
  });

  it("Should reject service items without serviceId", () => {
    const errors = validateCheckoutPayload({
      customerId: "cust-1",
      paymentMethod: "cash",
      items: [{ type: "service", qty: 1, price: 5.0 }]
    });
    expect(errors.some(e => e.includes("is missing serviceId"))).toBe(true);
  });

  it("Should reject product items without productId", () => {
    const errors = validateCheckoutPayload({
      customerId: "cust-1",
      paymentMethod: "cash",
      items: [{ type: "product", qty: 1, price: 8.0 }]
    });
    expect(errors.some(e => e.includes("is missing productId"))).toBe(true);
  });
});
