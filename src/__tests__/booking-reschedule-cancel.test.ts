import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260628000013_booking_reschedule_cancel.sql"),
  "utf8"
);

describe("Booking reschedule/cancel migration", () => {
  it("defines cancel and reschedule RPCs", () => {
    expect(sql).toContain("public_cancel_booking_v1");
    expect(sql).toContain("public_reschedule_booking_v1");
  });

  it("keeps RPCs security definer and public executable", () => {
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("TO anon, authenticated");
  });

  it("validates portal credentials and scheduled/future appointments", () => {
    expect(sql).toContain("invalid_portal_credentials");
    expect(sql).toContain("only_scheduled_can_be_cancelled");
    expect(sql).toContain("only_scheduled_can_be_rescheduled");
    expect(sql).toContain("new_time_must_be_in_future");
  });
});
