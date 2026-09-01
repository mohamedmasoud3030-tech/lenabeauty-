import { describe, expect, it, vi, beforeEach, afterAll } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { useCases } from "../app/composition/useCases";
import ServicesPage from "../pages/ServicesPage";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

/**
 * Slice D — Service Recipes: a server-backed recipe manager over real products.
 * Verifies that the catalog opens a recipe editor, lists only real products,
 * validates quantity/unit/cost, and saves through the repository contract.
 */
describe("Service Recipes (Slice D)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await i18n.changeLanguage("ar");
  });

  function renderPage() {
    return render(
      <ToastProvider>
        <ConfirmProvider>
          <ServicesPage />
        </ConfirmProvider>
      </ToastProvider>,
    );
  }

  const service = { id: "svc-1", name: "قص شعر", categoryId: "شعر", price: 5, durationMinutes: 30, isActive: true };
  const products = [
    { id: "p1", name: "شامبو", stockQuantity: 12, price: 3, cost: 1.2, isActive: true, trackInventory: true },
    { id: "p2", name: "منشفة", stockQuantity: 40, price: 2, cost: 0.5, isActive: true, trackInventory: true },
  ];

  it("opens the recipe editor, lists real products, and saves validated lines through the repository", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [service] } as any);
    vi.spyOn(useCases.products, "list").mockResolvedValue({ ok: true, data: products } as any);
    vi.spyOn(useCases.recipes, "getForService").mockResolvedValue({ ok: true, data: null } as any);
    vi.spyOn(useCases.recipes, "listConsumptions").mockResolvedValue({ ok: true, data: [] } as any);
    const saveSpy = vi.spyOn(useCases.recipes, "saveForService").mockResolvedValue({
      ok: true,
      data: { id: "r1", serviceId: "svc-1", isActive: true, items: [] },
    } as any);

    renderPage();

    // Open the recipe editor from the service row.
    const openButtons = await screen.findAllByTitle(i18n.t("recipe.title"));
    fireEvent.click(openButtons[0]);

    // The editor lists only real products (the catalog's products).
    const editor = await screen.findByText(i18n.t("recipe.hint"));
    expect(editor).toBeInTheDocument();
    const select = (await screen.findByLabelText(i18n.t("recipe.product"))) as HTMLSelectElement;
    const optionNames = Array.from(select.options).map((o) => o.textContent);
    expect(optionNames).toContain("شامبو");
    expect(optionNames).toContain("منشفة");

    // Fill a line: product + quantity + unit + cost, then save.
    fireEvent.change(select, { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText(i18n.t("recipe.quantity")), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText(i18n.t("recipe.unit")), { target: { value: "ml" } });
    fireEvent.change(screen.getByLabelText(i18n.t("recipe.estimatedCost")), { target: { value: "1.5" } });

    fireEvent.click(screen.getByText(i18n.t("Save Changes")));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    expect(saveSpy).toHaveBeenCalledWith("svc-1", [
      { productId: "p1", quantity: 2, unit: "ml", estimatedCost: 1.5 },
    ]);
  });

  it("rejects a non-positive quantity and does not call the repository", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [service] } as any);
    vi.spyOn(useCases.products, "list").mockResolvedValue({ ok: true, data: products } as any);
    vi.spyOn(useCases.recipes, "getForService").mockResolvedValue({ ok: true, data: null } as any);
    vi.spyOn(useCases.recipes, "listConsumptions").mockResolvedValue({ ok: true, data: [] } as any);
    const saveSpy = vi.spyOn(useCases.recipes, "saveForService").mockResolvedValue({ ok: true, data: null } as any);

    renderPage();

    const openButtons = await screen.findAllByTitle(i18n.t("recipe.title"));
    fireEvent.click(openButtons[0]);

    const select = (await screen.findByLabelText(i18n.t("recipe.product"))) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "p1" } });
    fireEvent.change(screen.getByLabelText(i18n.t("recipe.quantity")), { target: { value: "0" } });
    fireEvent.click(screen.getByText(i18n.t("Save Changes")));

    expect(await screen.findByText(i18n.t("recipe.errQuantity"))).toBeInTheDocument();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it("shows the selected product's real stock inside the recipe line", async () => {
    await i18n.changeLanguage("ar");
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [service] } as any);
    vi.spyOn(useCases.products, "list").mockResolvedValue({ ok: true, data: products } as any);
    vi.spyOn(useCases.recipes, "getForService").mockResolvedValue({ ok: true, data: null } as any);
    vi.spyOn(useCases.recipes, "listConsumptions").mockResolvedValue({ ok: true, data: [] } as any);

    renderPage();

    const openButtons = await screen.findAllByTitle(i18n.t("recipe.title"));
    fireEvent.click(openButtons[0]);

    const select = (await screen.findByLabelText(i18n.t("recipe.product"))) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "p1" } });

    // Stock surface is real repository data, never fabricated.
    const line = select.closest("[data-recipe-line]");
    expect(within(line as HTMLElement).getByText("12")).toBeInTheDocument();
  });
});
