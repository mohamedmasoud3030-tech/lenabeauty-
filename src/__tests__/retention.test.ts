import { describe, expect, it } from "vitest";
import {
  getCustomerVisitPattern,
  getNextBestCustomerAction,
  getRetentionStatus,
  getSuggestedRebookingWindow,
  retentionVisitsFromHistory,
  RetentionVisit,
} from "../domain/retention";

const day = (offset: number): string => {
  const d = new Date("2026-09-01T10:00:00Z");
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

function visits(offsets: number[], serviceId = "nails"): RetentionVisit[] {
  return offsets.map((offset, i) => ({
    id: `v-${i}`,
    dateTimeISO: day(offset),
    serviceId,
    serviceName: "Nails",
  }));
}

describe("Retention Engine", () => {
  it("returns no rebooking window with insufficient history", () => {
    expect(getSuggestedRebookingWindow(visits([-30]))).toBeNull();
    expect(getSuggestedRebookingWindow([])).toBeNull();
  });

  it("derives a deterministic rebooking window from repeat cadence", () => {
    // 21, 24, 27 days apart → window roughly 21..28 days.
    const window = getSuggestedRebookingWindow(visits([-72, -48, -24, 0]));
    expect(window).not.toBeNull();
    expect(window!.sampleSize).toBe(3);
    expect(window!.minDays).toBeGreaterThanOrEqual(18);
    expect(window!.maxDays).toBeLessThanOrEqual(33);
    expect(window!.minDays).toBeLessThanOrEqual(window!.maxDays);
  });

  it("insufficient history produces no fake recommendation", () => {
    const action = getNextBestCustomerAction(visits([-5]));
    expect(action.kind).toBe("BOOK_NEXT"); // first visit: invite a next visit, not a cadence claim
    expect(action.rebookingWindow).toBeUndefined();

    const none = getNextBestCustomerAction([]);
    expect(none.kind).toBe("NONE");
  });

  it("a recent visit is not classified as dormant", () => {
    const status = getRetentionStatus(visits([-72, -48, -24, -5]));
    expect(["ACTIVE", "DUE_FOR_REBOOK"]).toContain(status.status);
    expect(status.status).not.toBe("DORMANT");
    expect(status.status).not.toBe("WINBACK");
  });

  it("classifies a customer past cadence as due for rebook, then dormant/winback", () => {
    // Cadence ~26–32 days, last visit 32 days ago → due for rebook.
    const due = getRetentionStatus(visits([-90, -60, -32]));
    expect(due.status).toBe("DUE_FOR_REBOOK");

    // 60 days since last visit → dormant (formerly active, now lapsed).
    const dormant = getRetentionStatus(visits([-120, -90, -60]));
    expect(dormant.status).toBe("DORMANT");

    const winback = getRetentionStatus(visits([-200, -160]));
    expect(winback.status).toBe("WINBACK");
  });

  it("produces an actionable next-best step for a lapsed customer", () => {
    const action = getNextBestCustomerAction(visits([-90, -60, -34]));
    expect(action.kind).toBe("REBOOK");
    expect(action.daysSinceLastVisit).toBe(34);
  });

  it("does not double-count an invoice already linked to a completed appointment", () => {
    const reduced = retentionVisitsFromHistory({
      appointments: [
        { id: "a1", dateTime: new Date("2026-09-01T10:00:00Z"), status: "COMPLETED", serviceId: "nails", service: { name: "Nails" } },
      ],
      invoices: [
        { id: "i1", date: new Date("2026-09-01T10:00:00Z"), totalAmount: 30, appointmentId: "a1" },
        { id: "i2", date: new Date("2026-08-01T10:00:00Z"), totalAmount: 20 },
      ],
    });

    expect(reduced).toHaveLength(2);
    // The linked invoice is represented by its appointment; only the unlinked
    // invoice survives as its own visit.
    expect(reduced.map((v) => v.id)).toEqual(["i2", "a1"]);
    expect(getCustomerVisitPattern(reduced).totalVisits).toBe(2);
  });
});
