import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupabasePublicAccessAdapter } from "../infrastructure/supabase/repositories/publicAccess";

/**
 * Adapter contracts for the customer ratings surface: RPC names, argument
 * shapes, and row→domain mapping for the three new public functions plus the
 * profile's reviews mapping (the portal shows the customer's own ratings).
 */

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("../infrastructure/supabase/client", () => ({
  getSupabaseClient: () => ({ rpc: h.rpc }),
}));

const CREDENTIALS = { centerId: "ctr-1", phone: "91234567", token: "abcd1234" };
const ROW = {
  id: "r1",
  appointment_id: "a1",
  rating: 4,
  comment: "nice",
  is_published: true,
  created_at: "2026-09-13T10:00:00Z",
};

describe("SupabasePublicAccessAdapter — customer ratings", () => {
  const adapter = new SupabasePublicAccessAdapter();

  beforeEach(() => {
    h.rpc.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("portalRateVisit logs in first, then writes the rating with the resolved customer id", async () => {
    h.rpc
      .mockResolvedValueOnce({ data: { customer: { id: "c1", name: "Sara" } }, error: null }) // portalLogin
      .mockResolvedValueOnce({ data: ROW, error: null }); // rate write

    const result = await adapter.portalRateVisit(CREDENTIALS, "a1", 4, "  nice  ");

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toEqual({
      id: "r1",
      appointmentId: "a1",
      rating: 4,
      comment: "nice",
      isPublished: true,
      createdAtISO: "2026-09-13T10:00:00Z",
    });
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(h.rpc.mock.calls[1][0]).toBe("public_client_portal_rate_visit_v1");
    expect(h.rpc.mock.calls[1][1]).toEqual({
      p_center_id: "ctr-1",
      p_customer_id: "c1",
      p_appointment_id: "a1",
      p_phone: "91234567",
      p_token: "abcd1234",
      p_rating: 4,
      p_comment: "nice", // trimmed server-side too, but the client sends it clean
    });
  });

  it("portalRateVisit does not write when the portal login fails", async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: "invalid_portal_credentials" } });

    const result = await adapter.portalRateVisit(CREDENTIALS, "a1", 4);

    expect(result.ok).toBe(false);
    expect(h.rpc).toHaveBeenCalledTimes(1); // login only
  });

  it("lookupInvoiceRating maps the receipt lookup row", async () => {
    h.rpc.mockResolvedValueOnce({
      data: {
        center_id: "ctr-1",
        center_name: "Lena Salon",
        invoice_id: "inv-1",
        date: "2026-09-10T14:00:00Z",
        total_amount: 25,
        appointment_id: "a1",
        service_name: "Haircut",
        employee_name: "Sara",
        existing_rating: null,
      },
      error: null,
    });

    const result = await adapter.lookupInvoiceRating("inv-1");

    expect(result.ok).toBe(true);
    expect(result.ok && result.data).toMatchObject({
      centerId: "ctr-1",
      centerName: "Lena Salon",
      invoiceId: "inv-1",
      totalAmount: 25,
      appointmentId: "a1",
      serviceName: "Haircut",
      employeeName: "Sara",
      existingRating: null,
    });
    expect(h.rpc.mock.calls[0][0]).toBe("public_invoice_rating_lookup_v1");
    expect(h.rpc.mock.calls[0][1]).toEqual({ p_invoice_id: "inv-1" });
  });

  it("rateFromInvoice writes by invoice id with a trimmed comment", async () => {
    h.rpc.mockResolvedValueOnce({ data: ROW, error: null });

    const result = await adapter.rateFromInvoice("inv-1", 5, "  great  ");

    expect(result.ok).toBe(true);
    expect(h.rpc.mock.calls[0][0]).toBe("public_invoice_rate_visit_v1");
    expect(h.rpc.mock.calls[0][1]).toEqual({ p_invoice_id: "inv-1", p_rating: 5, p_comment: "great" });
  });

  it("portalProfile surfaces the customer's own reviews for the portal stars", async () => {
    h.rpc
      .mockResolvedValueOnce({ data: { customer: { id: "c1", name: "Sara" } }, error: null }) // login
      .mockResolvedValueOnce({
        data: {
          customer: { id: "c1", name: "Sara", phone: "91234567", loyalty_points: 10, total_spent: 20 },
          appointments: [],
          invoices: [],
          reviews: [ROW, { id: "r0", appointment_id: null, rating: 3, comment: null, is_published: true, created_at: "2026-09-01T10:00:00Z" }],
        },
        error: null,
      });

    const result = await adapter.portalProfile(CREDENTIALS);

    expect(result.ok).toBe(true);
    expect(result.ok && result.data.reviews).toEqual([
      { id: "r1", appointmentId: "a1", rating: 4, comment: "nice", isPublished: true, createdAtISO: "2026-09-13T10:00:00Z" },
      { id: "r0", appointmentId: null, rating: 3, comment: null, isPublished: true, createdAtISO: "2026-09-01T10:00:00Z" },
    ]);
  });
});
