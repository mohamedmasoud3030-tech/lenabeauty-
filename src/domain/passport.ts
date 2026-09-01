import { Appointment, AppointmentStatus, Invoice, ServiceFile } from "./entities";
import { roundMoney } from "./commerce";
import { effectiveVisitStage, UnifiedVisitStage } from "./visit";

/**
 * Beauty Passport — the composed, permanent salon memory of a customer.
 *
 * No new customer database: this module composes the existing customer,
 * appointments, invoices and service files into one coherent view. Pure and
 * framework-free so it is unit-testable independent of the UI.
 */

export interface PassportVisit {
  id: string;
  /** ISO date-time (stable ordering key). */
  dateTimeISO: string;
  stage: UnifiedVisitStage;
  serviceName?: string;
  employeeName?: string;
  amount?: number;
  notes?: string;
  images?: string[];
  /** Invoice id so the operator can re-open the receipt. */
  invoiceId?: string;
  /** Appointment id so the operator can rebook from the same visit. */
  appointmentId?: string;
}

export interface PassportSummary {
  lastVisitISO?: string;
  nextAppointmentISO?: string;
  preferredEmployeeName?: string;
  mostUsedServiceName?: string;
  averageVisitValue?: number;
  totalVisits: number;
  lifetimeSpend: number;
}

export interface BeautyPassport {
  summary: PassportSummary;
  timeline: PassportVisit[];
}

export interface PassportComposeInput {
  appointments: Appointment[];
  invoices: Invoice[];
  serviceFiles?: ServiceFile[];
  nextAppointment?: Appointment;
  lifetimeSpend?: number;
}

function onlyPaid(invoices: Invoice[]): Invoice[] {
  return invoices.filter((i) => i.status !== "VOID");
}

/** Flatten before/after/reference images attached to service files. */
function imagesForAppointment(
  serviceFiles: ServiceFile[] | undefined,
  appointmentId: string,
): string[] {
  const files = (serviceFiles ?? []).filter((f) => f.appointmentId === appointmentId);
  const images: string[] = [];
  for (const file of files) {
    for (const image of file.images ?? []) {
      if (image?.imageUrl) images.push(image.imageUrl);
    }
  }
  return images;
}

/**
 * Compose the chronological visit timeline from appointments (the source of
 * visit identity) merged with paid invoices (money + receipt) and service
 * files (media).
 */
export function composeVisitTimeline(input: PassportComposeInput): PassportVisit[] {
  const invoicesByAppointment = new Map<string, Invoice[]>();
  for (const inv of onlyPaid(input.invoices)) {
    const key = inv.appointmentId ?? "";
    invoicesByAppointment.set(key, [...(invoicesByAppointment.get(key) ?? []), inv]);
  }
  // Unlinked paid invoices (no appointment reference) still count as visits.
  const usedInvoiceIds = new Set<string>();

  const timeline: PassportVisit[] = [];
  for (const appt of input.appointments) {
    const invoices = invoicesByAppointment.get(appt.id) ?? [];
    const invoice = invoices[0];
    if (invoice) usedInvoiceIds.add(invoice.id);
    timeline.push({
      id: appt.id,
      dateTimeISO: new Date(appt.dateTime).toISOString(),
      stage: effectiveVisitStage(appt),
      serviceName: appt.service?.name,
      employeeName: appt.employee?.name,
      amount: invoice ? Number(invoice.totalAmount) : undefined,
      notes: appt.notes,
      images: imagesForAppointment(input.serviceFiles, appt.id),
      invoiceId: invoice?.id,
      appointmentId: appt.id,
    });
  }

  for (const inv of onlyPaid(input.invoices)) {
    if (usedInvoiceIds.has(inv.id)) continue;
    timeline.push({
      id: inv.id,
      dateTimeISO: new Date(inv.date).toISOString(),
      stage: "COMPLETED",
      amount: Number(inv.totalAmount),
      invoiceId: inv.id,
    });
  }

  return timeline.sort(
    (a, b) => new Date(a.dateTimeISO).getTime() - new Date(b.dateTimeISO).getTime(),
  );
}

export function composePassportSummary(
  input: PassportComposeInput,
  timeline: PassportVisit[],
): PassportSummary {
  const paidInvoices = onlyPaid(input.invoices);
  // Only visits with a paid invoice carry spend; unfinished visits do not.
  const withAmount = timeline.filter((v) => v.amount !== undefined);

  const employeeCounts = new Map<string, number>();
  const serviceCounts = new Map<string, number>();
  for (const appt of input.appointments) {
    if (appt.status !== AppointmentStatus.COMPLETED) continue;
    if (appt.employee?.name) {
      employeeCounts.set(appt.employee.name, (employeeCounts.get(appt.employee.name) ?? 0) + 1);
    }
    if (appt.service?.name) {
      serviceCounts.set(appt.service.name, (serviceCounts.get(appt.service.name) ?? 0) + 1);
    }
  }
  const topBy = (map: Map<string, number>) => {
    let best: string | undefined;
    let count = 0;
    for (const [name, n] of map.entries()) if (n > count) { best = name; count = n; }
    return best;
  };

  const lifetimeSpend = input.lifetimeSpend !== undefined
    ? Number(input.lifetimeSpend)
    : paidInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const last = timeline[timeline.length - 1];

  return {
    lastVisitISO: last?.dateTimeISO,
    nextAppointmentISO: input.nextAppointment
      ? new Date(input.nextAppointment.dateTime).toISOString()
      : undefined,
    preferredEmployeeName: topBy(employeeCounts),
    mostUsedServiceName: topBy(serviceCounts),
    averageVisitValue: withAmount.length > 0
      ? roundMoney(withAmount.reduce((sum, v) => sum + (v.amount ?? 0), 0) / withAmount.length)
      : undefined,
    totalVisits: timeline.length,
    lifetimeSpend: roundMoney(Math.max(0, lifetimeSpend)),
  };
}

/** Full passport: summary + timeline. */
export function composeBeautyPassport(input: PassportComposeInput): BeautyPassport {
  const timeline = composeVisitTimeline(input);
  return { summary: composePassportSummary(input, timeline), timeline };
}
