/**
 * Retention Engine — deterministic, data-driven customer rebooking signals.
 *
 * No probabilities, no fabricated recommendations. Every function derives its
 * answer from real visit history. When history is insufficient, the answer is
 * "no recommendation", never a guessed one.
 *
 * The tier model (src/domain/loyalty.ts) remains recognition/status; this
 * module is the retention intelligence that drives the *next profitable visit*.
 */

export interface RetentionVisit {
  id: string;
  /** ISO date-time of the visit. */
  dateTimeISO: string;
  /** Service id where the visit had exactly one booked service. */
  serviceId?: string;
  serviceName?: string;
  amount?: number;
}

export interface RebookingWindow {
  /** Inclusive lower bound of the usual repeat cadence, in days. */
  minDays: number;
  /** Inclusive upper bound of the usual repeat cadence, in days. */
  maxDays: number;
  /** Number of observed intervals the window is based on. */
  sampleSize: number;
}

export type RetentionStatus =
  | "INSUFFICIENT_HISTORY"
  | "NEW"
  | "ACTIVE"
  | "DUE_FOR_REBOOK"
  | "DORMANT"
  | "WINBACK";

export interface RetentionStatusResult {
  status: RetentionStatus;
  /** Days since the most recent visit (0 when there is no visit). */
  daysSinceLastVisit: number | null;
  /** Window when the customer usually returns, if determinable. */
  rebookingWindow: RebookingWindow | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sortedVisits(visits: RetentionVisit[]): RetentionVisit[] {
  return [...visits]
    .filter((v) => {
      const d = new Date(v.dateTimeISO).getTime();
      return Number.isFinite(d);
    })
    .sort((a, b) => new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime());
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  return Math.max(0, Math.round((b - a) / DAY_MS));
}

/**
 * Suggested rebooking window for a customer (optionally for a specific
 * service). Derived from the inter-visit gaps of the same service; when the
 * customer has fewer than two visits for that service, the result is null —
 * there is nothing deterministic to recommend.
 */
export function getSuggestedRebookingWindow(
  visits: RetentionVisit[],
  serviceId?: string,
): RebookingWindow | null {
  const relevant = serviceId
    ? sortedVisits(visits).filter((v) => v.serviceId === serviceId)
    : sortedVisits(visits);
  if (relevant.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < relevant.length; i += 1) {
    const gap = daysBetween(relevant[i - 1].dateTimeISO, relevant[i].dateTimeISO);
    if (gap > 0) gaps.push(gap);
  }
  if (gaps.length === 0) return null;

  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length % 2 === 1
    ? sorted[Math.floor(sorted.length / 2)]
    : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
  // A tight, defensible window from the observed quartiles (no invented math).
  const q1 = sorted[Math.floor(sorted.length / 4)];
  const q3 = sorted[Math.floor((sorted.length * 3) / 4)];
  const minDays = Math.max(1, Math.min(q1, median) - 2);
  const maxDays = Math.max(minDays, Math.max(q3, median) + 2);
  return { minDays, maxDays, sampleSize: gaps.length };
}

function medianGap(visits: RetentionVisit[], serviceId?: string): number | null {
  const window = getSuggestedRebookingWindow(visits, serviceId);
  return window ? Math.round((window.minDays + window.maxDays) / 2) : null;
}

/**
 * Deterministic retention status:
 *  - INSUFFICIENT_HISTORY: no visits at all.
 *  - NEW: exactly one visit (or no cadence) — cannot yet recommend a rhythm.
 *  - ACTIVE: last visit within the usual cadence (or within 14 days when no
 *    cadence exists) — a recent visit must never be called dormant.
 *  - DUE_FOR_REBOOK: past the usual cadence but not yet dormant.
 *  - DORMANT: noticeably past cadence (≥ 1.5× window) or > 45 days with no cadence.
 *  - WINBACK: long absence (≥ 90 days) — a formerly active customer to contact.
 */
export function getRetentionStatus(
  visits: RetentionVisit[],
  now: Date = new Date(),
  serviceId?: string,
): RetentionStatusResult {
  const ordered = sortedVisits(visits);
  if (ordered.length === 0) {
    return { status: "INSUFFICIENT_HISTORY", daysSinceLastVisit: null, rebookingWindow: null };
  }
  const last = ordered.at(-1);
  const daysSinceLastVisit = daysBetween(last!.dateTimeISO, now.toISOString());
  const window = getSuggestedRebookingWindow(ordered, serviceId);

  if (ordered.length < 2) {
    return { status: "NEW", daysSinceLastVisit, rebookingWindow: window };
  }
  if (!window) {
    let status: RetentionStatus;
    if (daysSinceLastVisit <= 14) {
      status = "ACTIVE";
    } else if (daysSinceLastVisit <= 45) {
      status = "DUE_FOR_REBOOK";
    } else if (daysSinceLastVisit <= 90) {
      status = "DORMANT";
    } else {
      status = "WINBACK";
    }
    return { status, daysSinceLastVisit, rebookingWindow: null };
  }

  const mid = Math.round((window.minDays + window.maxDays) / 2);
  if (daysSinceLastVisit <= mid) return { status: "ACTIVE", daysSinceLastVisit, rebookingWindow: window };
  if (daysSinceLastVisit <= window.maxDays) return { status: "DUE_FOR_REBOOK", daysSinceLastVisit, rebookingWindow: window };
  if (daysSinceLastVisit <= Math.max(60, Math.round(window.maxDays * 1.5))) {
    return { status: "DORMANT", daysSinceLastVisit, rebookingWindow: window };
  }
  return { status: "WINBACK", daysSinceLastVisit, rebookingWindow: window };
}

export interface VisitPattern {
  totalVisits: number;
  distinctServices: number;
  mostVisitedServiceId?: string;
  mostVisitedServiceName?: string;
  averageDaysBetweenVisits: number | null;
}

export function getCustomerVisitPattern(visits: RetentionVisit[]): VisitPattern {
  const ordered = sortedVisits(visits);
  const counts = new Map<string, { name?: string; count: number }>();
  for (const v of ordered) {
    const key = v.serviceId ?? v.serviceName ?? "__untracked__";
    const entry = counts.get(key) ?? { name: v.serviceName, count: 0 };
    entry.count += 1;
    entry.name = entry.name ?? v.serviceName;
    counts.set(key, entry);
  }
  let mostVisitedServiceId: string | undefined;
  let mostVisitedServiceName: string | undefined;
  let mostCount = 0;
  for (const [key, entry] of counts.entries()) {
    if (entry.count > mostCount) {
      mostCount = entry.count;
      mostVisitedServiceId = key === "__untracked__" ? undefined : key;
      mostVisitedServiceName = entry.name;
    }
  }
  let averageDaysBetweenVisits: number | null = null;
  if (ordered.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      const gap = daysBetween(ordered[i - 1].dateTimeISO, ordered[i].dateTimeISO);
      if (gap > 0) gaps.push(gap);
    }
    if (gaps.length > 0) {
      averageDaysBetweenVisits = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }
  }
  return {
    totalVisits: ordered.length,
    distinctServices: counts.size,
    mostVisitedServiceId,
    mostVisitedServiceName,
    averageDaysBetweenVisits,
  };
}

export interface NextBestAction {
  /** Deterministic action kind — never a decorative suggestion. */
  kind: "REBOOK" | "CONTACT" | "BOOK_NEXT" | "NONE";
  /** i18n key for the headline, resolved at the UI boundary. */
  titleKey: string;
  /** i18n key for the supporting detail. */
  detailKey: string;
  /** Concrete rebooking window in days, when determinable. */
  rebookingWindow?: RebookingWindow;
  daysSinceLastVisit: number | null;
}

/**
 * The single next-best action for a customer, derived from the retention status
 * plus a suggested rebooking window. Returns a "no recommendation" action when
 * history is insufficient — never a fabricated next step.
 */
export function getNextBestCustomerAction(
  visits: RetentionVisit[],
  now: Date = new Date(),
  preferredServiceId?: string,
): NextBestAction {
  const status = getRetentionStatus(visits, now, preferredServiceId);
  const window = status.rebookingWindow ?? getSuggestedRebookingWindow(visits);

  if (status.status === "INSUFFICIENT_HISTORY") {
    return { kind: "NONE", titleKey: "retention.action.none", detailKey: "retention.noHistory", daysSinceLastVisit: null };
  }
  if (status.status === "NEW") {
    return { kind: "BOOK_NEXT", titleKey: "retention.action.bookNext", detailKey: "retention.firstVisit", daysSinceLastVisit: status.daysSinceLastVisit };
  }
  if (status.status === "ACTIVE") {
    return { kind: "NONE", titleKey: "retention.action.none", detailKey: "retention.onCadence", daysSinceLastVisit: status.daysSinceLastVisit };
  }
  if (status.status === "DUE_FOR_REBOOK" || status.status === "DORMANT") {
    return {
      kind: "REBOOK",
      titleKey: "retention.action.rebook",
      detailKey: window ? "retention.dueRebookWindow" : "retention.dueRebook",
      rebookingWindow: window ?? undefined,
      daysSinceLastVisit: status.daysSinceLastVisit,
    };
  }
  // WINBACK
  return {
    kind: "CONTACT",
    titleKey: "retention.action.contact",
    detailKey: "retention.winback",
    rebookingWindow: window ?? undefined,
    daysSinceLastVisit: status.daysSinceLastVisit,
  };
}

/** Convenience: the visits of one customer reduced from a raw history payload. */
export function retentionVisitsFromHistory(history: {
  appointments: {
    id: string;
    dateTime: Date;
    status: string;
    serviceId?: string;
    service?: { name?: string };
  }[];
  invoices: {
    id: string;
    date: Date;
    totalAmount: number;
    appointmentId?: string;
  }[];
}): RetentionVisit[] {
  const appointmentIds = new Set(history.appointments.map((a) => a.id));
  const visits: RetentionVisit[] = history.appointments
    .filter((a) => a.status === "COMPLETED")
    .map((a) => ({
      id: a.id,
      dateTimeISO: new Date(a.dateTime).toISOString(),
      serviceId: a.serviceId,
      serviceName: a.service?.name,
    }));
  // Merge invoices that are not already represented by their linked
  // appointment (checkout links invoice → appointment). Without this guard a
  // single paid visit would be counted twice — once from the appointment and
  // once from its linked invoice — distorting cadence and totals.
  const invoiceVisits: RetentionVisit[] = history.invoices
    .filter((inv) => !inv.appointmentId || !appointmentIds.has(inv.appointmentId))
    .map((inv) => ({
      id: inv.id,
      dateTimeISO: new Date(inv.date).toISOString(),
      amount: Number(inv.totalAmount) || 0,
    }));
  return [...visits, ...invoiceVisits].sort(
    (a, b) => new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime(),
  );
}
