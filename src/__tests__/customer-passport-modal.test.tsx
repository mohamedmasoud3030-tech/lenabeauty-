import { beforeEach, describe, expect, it, vi, afterAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CustomerPassportModal, CustomerHistoryData } from "../pages/customers/CustomerPassportModal";
import { Appointment, AppointmentStatus, Customer, Invoice, ServiceFile, VisitStage } from "../domain/entities";
import i18n from "../i18n";

/**
 * Direct render tests for the passport modal. The modal is fully controlled
 * (props in, no async of its own), so these are deterministic: no timers, no
 * fetch mocks, no waiting — the page-level test (beauty-passport.test.tsx)
 * covers the async composition path, this file pins the presentation
 * contracts of every section.
 */

const appt = (partial: Partial<Appointment>): Appointment => ({
  id: "a1",
  customerId: "c1",
  dateTime: new Date("2026-08-01T10:00:00"),
  status: AppointmentStatus.COMPLETED,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...partial,
});

const invoice = (partial: Partial<Invoice> = {}): Invoice => ({
  id: "inv-1",
  customerId: "c1",
  totalAmount: 30,
  subtotalAmount: 30,
  discount: 0,
  manualDiscount: 0,
  tierDiscount: 0,
  loyaltyDiscount: 0,
  giftCardDiscount: 0,
  entitlementRedemption: 0,
  amountPaid: 30,
  loyaltyPointsUsed: 0,
  paymentMethod: "cash",
  date: new Date("2026-08-01T10:30:00"),
  status: "PAID",
  appointmentId: "a1",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...partial,
});

const customer: Customer = {
  id: "cust-abcdef",
  name: "Amal",
  phone: "90000000",
  totalSpent: 275,
  loyaltyPoints: 120,
  createdAt: new Date("2026-01-15T10:00:00"),
  updatedAt: new Date("2026-01-15T10:00:00"),
};

const futureAppt = appt({
  id: "a2",
  dateTime: new Date("2026-10-01T11:00:00"),
  status: AppointmentStatus.SCHEDULED,
  visitStage: VisitStage.BOOKED,
  depositAmount: 10,
  service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
  employee: { id: "e1", name: "Sara" },
});

const completedAppt = appt({
  service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
  employee: { id: "e1", name: "Sara" },
});

const history: CustomerHistoryData = {
  appointments: [completedAppt, futureAppt],
  invoices: [invoice()],
};

const serviceFiles: ServiceFile[] = [
  {
    id: "f1",
    centerId: "ctr",
    customerId: "c1",
    appointmentId: "a1",
    title: "Before / After",
    note: "Color batch 12",
    createdAt: new Date("2026-08-01T11:00:00"),
    updatedAt: new Date("2026-08-01T11:00:00"),
  },
];

function renderModal(overrides: Record<string, unknown> = {}) {
  const onNotesChange = vi.fn();
  const onSaveNotes = vi.fn();
  const onToggleAllVisits = vi.fn();
  const onReprint = vi.fn();
  const onClose = vi.fn();
  render(
    <CustomerPassportModal
      open={true}
      onClose={onClose}
      customer={customer}
      history={history}
      serviceFiles={serviceFiles}
      entitlements={[]}
      notes="Allergic to PPD"
      onNotesChange={onNotesChange}
      savingNotes={false}
      onSaveNotes={onSaveNotes}
      showAllVisits={false}
      onToggleAllVisits={onToggleAllVisits}
      onReprint={onReprint}
      {...overrides}
    />,
  );
  return { onNotesChange, onSaveNotes, onToggleAllVisits, onReprint, onClose };
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

afterAll(async () => {
  await i18n.changeLanguage("ar");
});

describe("CustomerPassportModal", () => {
  it("renders nothing while closed and a loading state while history is missing", () => {
    const closed = render(<CustomerPassportModal open={false} onClose={() => {}} customer={customer} history={history} serviceFiles={[]} entitlements={[]} notes="" onNotesChange={() => {}} savingNotes={false} onSaveNotes={() => {}} showAllVisits={false} onToggleAllVisits={() => {}} onReprint={() => {}} />);
    expect(screen.queryByText(i18n.t("passport.title"))).toBeNull();
    closed.unmount();

    renderModal({ history: null });
    expect(screen.getByText(i18n.t("Fetching Data..."))).toBeInTheDocument();
  });

  it("shows the identity strip: name, phone, client id, points and lifetime spend", () => {
    renderModal();
    expect(screen.getByText(i18n.t("passport.title"))).toBeInTheDocument();
    // Name appears in the modal description and the identity strip.
    expect(screen.getAllByText("Amal").length).toBeGreaterThan(0);
    expect(screen.getByText("90000000")).toBeInTheDocument();
    // Client ID is the last six characters, uppercased.
    expect(screen.getByText(`${i18n.t("Client ID")}: ABCDEF`)).toBeInTheDocument();
    // Points chip (identity strip + wallet line) — number and unit share a span.
    expect(screen.getAllByText("120 pts").length).toBeGreaterThanOrEqual(2);
    // 275 -> OMR with three fixed fractions (identity chip + lifetime-spend chip).
    expect(screen.getAllByText("275.000 OMR").length).toBeGreaterThanOrEqual(1);
  });

  it("composes the snapshot, next booking, wallet and retention from the same props", () => {
    renderModal();

    // Snapshot chips.
    expect(screen.getByText(i18n.t("passport.snapshot"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("passport.totalVisits"))).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // completed + upcoming
    // Preferred employee chip + next-booking line + timeline entry.
    expect(screen.getAllByText("Sara").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(i18n.t("passport.lifetimeSpend"))).toBeInTheDocument();

    // Next booking: the future scheduled visit, with deposit.
    expect(screen.getByText(i18n.t("passport.nextBooking"))).toBeInTheDocument();
    // The upcoming date shows in the next-booking line and the snapshot chips.
    expect(screen.getAllByText("1 Oct 2026").length).toBeGreaterThanOrEqual(2);
    // The deposit appears in the wallet line (and prefixed in the booking line).
    expect(screen.getByText("10.000 OMR")).toBeInTheDocument();

    // Retention with a future booking badge.
    expect(screen.getByText(i18n.t("passport.retention"))).toBeInTheDocument();
    expect(screen.getByText(i18n.t("retention.hasFutureBooking"))).toBeInTheDocument();

    // Wallet has value -> the empty state must not render.
    expect(screen.getByText(i18n.t("passport.wallet"))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("passport.walletEmpty"))).toBeNull();
  });

  it("renders the timeline with the merged paid invoice, reprint, notes and service files", () => {
    const { onNotesChange, onSaveNotes, onReprint } = renderModal();

    expect(screen.getByText(i18n.t("passport.timeline"))).toBeInTheDocument();
    // The completed visit carries the merged invoice amount and a reprint action.
    expect(screen.getAllByText("30.000 OMR").length).toBeGreaterThanOrEqual(1);
    const reprint = screen.getByRole("button", { name: i18n.t("Print") });
    fireEvent.click(reprint);
    expect(onReprint).toHaveBeenCalledWith("inv-1");

    // Notes: controlled textarea, save action, placeholder contract.
    const textarea = screen.getByPlaceholderText(i18n.t("Medical History / Preferences / Allergies"));
    expect(textarea).toHaveValue("Allergic to PPD");
    fireEvent.change(textarea, { target: { value: "Allergic to PPD — no highlights" } });
    expect(onNotesChange).toHaveBeenCalledWith("Allergic to PPD — no highlights");
    fireEvent.click(screen.getByRole("button", { name: i18n.t("Save Changes") }));
    expect(onSaveNotes).toHaveBeenCalledTimes(1);

    // Service files render title + note.
    expect(screen.getByText("Before / After")).toBeInTheDocument();
    expect(screen.getByText("Color batch 12")).toBeInTheDocument();
  });

  it("without a future booking, the next-booking section says so honestly", () => {
    renderModal({
      history: { appointments: [completedAppt], invoices: [invoice()] },
    });
    expect(screen.getByText(i18n.t("passport.noNextBooking"))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t("retention.hasFutureBooking"))).toBeNull();
  });

  it("folds long timelines to six visits behind a toggle", () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      appt({
        id: `v${i}`,
        dateTime: new Date(2026, 0, 1 + i * 4, 10),
        status: AppointmentStatus.COMPLETED,
        service: { id: "s1", name: "Haircut", durationMinutes: 30, durationMins: 30, price: 30 },
        employee: { id: "e1", name: "Sara" },
      }),
    );
    const { onToggleAllVisits } = renderModal({
      history: { appointments: many, invoices: [] },
      serviceFiles: [],
    });

    // 7 visits -> 6 visible, toggle offers the rest.
    expect(screen.getAllByText("Haircut").length).toBeGreaterThanOrEqual(6);
    const toggle = screen.getByRole("button", { name: i18n.t("passport.showAll") });
    fireEvent.click(toggle);
    expect(onToggleAllVisits).toHaveBeenCalledTimes(1);
  });
});
