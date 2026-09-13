import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppointmentsReportSection } from "../pages/reports/AppointmentsReportSection";
import type { AppointmentReportRow } from "../application/dto";

/**
 * The appointments report section computes its own on-screen status counts.
 * Note the contract difference with the print model (reportPrint.ts): the
 * on-screen completion rate divides by ALL rows, while the printed
 * "attendance rate" excludes scheduled rows.
 */

const t = (key: string) => key;

const row = (id: string, status: string): AppointmentReportRow =>
  ({ id, dateTime: new Date(2026, 8, 12, 10), status }) as unknown as AppointmentReportRow;

function renderSection(
  overrides: Partial<Parameters<typeof AppointmentsReportSection>[0]> = {},
) {
  const onRetry = vi.fn();
  const onBookAppointment = vi.fn();
  const view = render(
    <AppointmentsReportSection
      data={[]}
      error={null}
      onRetry={onRetry}
      onBookAppointment={onBookAppointment}
      t={t}
      {...overrides}
    />,
  );
  return { onRetry, onBookAppointment, unmount: view.unmount };
}

describe("appointments report section", () => {
  it("shows status cards and the completion rate over all rows", () => {
    renderSection({
      data: [
        row("a1", "COMPLETED"),
        row("a2", "COMPLETED"),
        row("a3", "COMPLETED"),
        row("a4", "SCHEDULED"),
        row("a5", "CANCELLED"),
        row("a6", "NO_SHOW"),
      ],
    });

    // 3 of 6 rows completed.
    expect(screen.getByText("Completion rate: 50%")).toBeInTheDocument();
    // The big total card.
    expect(screen.getAllByText("6", { selector: ".text-3xl" })).toHaveLength(1);
    // The distribution tiles (completed / scheduled / cancelled / no-show).
    expect(screen.getAllByText("3", { selector: ".text-xl" })).toHaveLength(1);
  });

  it("counts rows without a status as scheduled and rates an empty completion", () => {
    renderSection({ data: [row("a1", ""), row("a2", "SCHEDULED")] });
    expect(screen.getByText("Completion rate: 0%")).toBeInTheDocument();
    expect(screen.getAllByText("2", { selector: ".text-xl" })).toHaveLength(1);
  });

  it("empty data offers booking as the action", () => {
    const { onBookAppointment } = renderSection({ data: [] });
    expect(screen.getByText("No Appointments Data")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Book Appointment" }));
    expect(onBookAppointment).toHaveBeenCalledTimes(1);
  });

  it("the unsupported-backend error gets its own message, others keep the generic one", () => {
    const first = renderSection({ data: [], error: "BACKEND_METHOD_UNSUPPORTED" });
    expect(screen.getByText("Appointments report requires backend")).toBeInTheDocument();
    first.unmount();

    const { onRetry } = renderSection({ data: [], error: "boom" });
    expect(screen.getByText("Failed to load appointments report")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
