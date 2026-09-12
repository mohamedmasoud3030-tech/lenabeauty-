import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useCases } from "../app/composition/useCases";
import PosInvoicesPage, { CUSTOMER_SEARCH_DEBOUNCE_MS } from "../pages/PosInvoicesPage";
import { ToastProvider } from "../shared/components/Toast";
import i18n from "../i18n";

/**
 * The POS client search runs `ILIKE '%…%'` twice per input — once for the name,
 * once for the phone. A leading wildcard cannot use a btree index, so each of
 * those is a scan of the salon's client list, over the network, per keystroke.
 *
 * These tests measure the fix rather than describe it: how many queries one
 * typed name costs, and what happens to a search that is still scheduled when
 * the operator moves on.
 */

const SEARCH_PLACEHOLDER = "Search customer...";

function renderPos() {
  return render(
    <MemoryRouter initialEntries={["/pos"]}>
      <ToastProvider>
        <PosInvoicesPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

/** Waits past the debounce window, inside act() so React flushes the result. */
async function afterDebounce() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, CUSTOMER_SEARCH_DEBOUNCE_MS + 80));
  });
}

describe("POS customer search cost", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(useCases.services, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "s1", name: "قص شعر", price: 5, durationMinutes: 30, isActive: true }],
    } as any);
    vi.spyOn(useCases.products, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.servicePackages, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.settings, "get").mockResolvedValue({ ok: true, data: { taxRate: 0 } } as any);
    vi.spyOn(useCases.giftCards, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  it("costs one search per typed name, not one per keystroke", async () => {
    await i18n.changeLanguage("ar");
    const listSpy = vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "c1", name: "أمل", phone: "90000000" }],
    } as any);

    renderPos();
    await screen.findByText("قص شعر");
    const input = screen.getByPlaceholderText(i18n.t(SEARCH_PLACEHOLDER));

    // Eight keystrokes, as a name is typed.
    for (const value of ["أ", "أم", "أمل", "أمل ", "أمل س", "أمل سا", "أمل سار", "أمل سارة"]) {
      fireEvent.change(input, { target: { value } });
    }

    // Nothing has been sent yet: the operator is still typing.
    expect(listSpy).not.toHaveBeenCalled();
    // And the letters are on screen already, so typing never feels delayed.
    expect((input as HTMLInputElement).value).toBe("أمل سارة");

    await afterDebounce();

    // One request for the name, and the repository itself makes the second (phone)
    // query — the page no longer multiplies them by the number of keystrokes.
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledWith("أمل سارة");
  });

  it("does not search at all for a single letter", async () => {
    await i18n.changeLanguage("ar");
    const listSpy = vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);

    renderPos();
    await screen.findByText("قص شعر");
    const input = screen.getByPlaceholderText(i18n.t(SEARCH_PLACEHOLDER));

    fireEvent.change(input, { target: { value: "أ" } });
    await afterDebounce();

    expect(listSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("أمل")).not.toBeInTheDocument();
  });

  it("drops a scheduled search when the operator picks a client", async () => {
    await i18n.changeLanguage("ar");
    const listSpy = vi.spyOn(useCases.customers, "list").mockResolvedValue({
      ok: true,
      data: [{ id: "c1", name: "أمل", phone: "90000000" }],
    } as any);
    vi.spyOn(useCases.entitlements, "listForCustomer").mockResolvedValue({ ok: true, data: [] } as any);

    renderPos();
    await screen.findByText("قص شعر");
    const input = screen.getByPlaceholderText(i18n.t(SEARCH_PLACEHOLDER));

    fireEvent.change(input, { target: { value: "أمل" } });
    await afterDebounce();
    const callsAfterFirstSearch = listSpy.mock.calls.length;

    // A further keystroke schedules a search…
    fireEvent.change(input, { target: { value: "أمل س" } });
    // …and then the operator chooses from the results already on screen.
    fireEvent.click(await screen.findByText("أمل"));
    await afterDebounce();

    // The scheduled search must not have run: its result would repopulate a
    // dropdown over a sale that is already being closed.
    expect(listSpy.mock.calls.length).toBe(callsAfterFirstSearch);
    // And the field itself is gone — choosing a client replaces the search box
    // with the chosen client, so there is nothing left to repopulate.
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(i18n.t(SEARCH_PLACEHOLDER))).toBeNull(),
    );
  });
});
