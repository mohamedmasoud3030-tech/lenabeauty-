import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260628000006_public_booking.sql"),
  "utf8"
);

describe("Public booking migration", () => {
  it("defines all five public RPCs", () => {
    for (const fn of [
      "public_list_services_v1",
      "public_list_staff_v1",
      "public_center_info_v1",
      "public_taken_slots_v1",
      "public_create_booking_v1",
    ]) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }
  });

  it("exposes the RPCs to the anon role (public self-booking)", () => {
    expect(sql).toContain("TO anon, authenticated");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.public_create_booking_v1");
  });

  it("read RPCs only expose active + center-scoped rows", () => {
    expect(sql).toContain("is_active = true");
    expect(sql).toContain("center_id = p_center_id");
  });

  it("create RPC validates input and prevents past + double bookings", () => {
    expect(sql).toContain("Name and phone are required");
    expect(sql).toContain("Cannot book a time in the past");
    expect(sql).toContain("This time slot is no longer available");
  });

  it("create RPC finds-or-creates the customer by phone", () => {
    expect(sql).toContain("FROM public.customers c");
    expect(sql).toContain("INSERT INTO public.customers");
    expect(sql).toContain("INSERT INTO public.appointments");
  });

  it("create RPC is SECURITY DEFINER (bypasses RLS safely)", () => {
    expect(sql).toContain("SECURITY DEFINER");
  });
});
