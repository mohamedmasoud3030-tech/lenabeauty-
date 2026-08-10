import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InventoryPage from "../pages/InventoryPage";
import { ToastProvider } from "../shared/components/Toast";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import { useCases } from "../app/composition/useCases";
import i18n from "../i18n";

const product = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "p1",
  name: "Luxury Shampoo",
  stockQuantity: 3,
  price: 12.5,
  cost: 5,
  reorderLevel: 5,
  isActive: true,
  trackInventory: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

function renderPage() {
  return render(
    <ToastProvider>
      <ConfirmProvider>
        <InventoryPage />
      </ConfirmProvider>
    </ToastProvider>
  );
}

/** Wait until the list has settled (loading finished) by polling for the
 *  header "Add Product" CTA, which is always present. */
async function settled() {
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: /Add Product/i }).length).toBeGreaterThan(0)
  );
}

describe("Inventory modal CRUD (closed-by-default)", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.products, "listFull").mockResolvedValue({ ok: true, data: [] });
    vi.spyOn(useCases.products, "create").mockResolvedValue({ ok: true, data: product() });
  });

  it("does not render the create form permanently (form is closed by default)", async () => {
    renderPage();
    await settled();
    // The product-name field lives inside the closed modal, not on the page.
    expect(screen.queryAllByPlaceholderText(/Luxury Shampoo/i).length).toBe(0);
  });

  it("shows one empty-state CTA that opens the create form", async () => {
    renderPage();
    await settled();
    // The empty-state card exposes its own "Add Product" CTA (at least one).
    expect(screen.getAllByRole("button", { name: /Add Product/i }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Add Product/i })[0]);
    // Modal opens with the product-name field (single portal instance).
    expect(await screen.findByPlaceholderText(/Luxury Shampoo/i)).toBeInTheDocument();
    expect(screen.getByText(/New Product/i)).toBeInTheDocument();
  });

  it("creates a product from the modal and closes it on success", async () => {
    const create = vi.spyOn(useCases.products, "create");
    renderPage();
    await settled();
    fireEvent.click(screen.getAllByRole("button", { name: /Add Product/i })[0]);
    const nameInput = await screen.findByPlaceholderText(/Luxury Shampoo/i);
    fireEvent.change(nameInput, { target: { value: "Conditioner" } });
    // Selling price (decimal input) is the only empty decimal field.
    const priceInput = screen
      .getAllByDisplayValue("")
      .find((el) => el.getAttribute("inputmode") === "decimal")!;
    fireEvent.change(priceInput, { target: { value: "15" } });
    fireEvent.click(screen.getByRole("button", { name: /Add to Inventory/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/Luxury Shampoo/i)).toBeNull()
    );
  });

  it("opens the edit modal prefilled with the product name", async () => {
    vi.spyOn(useCases.products, "listFull").mockResolvedValue({
      ok: true,
      data: [product()],
    });
    vi.spyOn(useCases.products, "update").mockResolvedValue({ ok: true, data: product() });
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText(/Luxury Shampoo/i).length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]);
    expect(await screen.findByDisplayValue("Luxury Shampoo")).toBeInTheDocument();
    expect(screen.getByText(/Edit Product/i)).toBeInTheDocument();
  });

  it("confirms before deleting a product", async () => {
    vi.spyOn(useCases.products, "listFull").mockResolvedValue({
      ok: true,
      data: [product()],
    });
    const del = vi.spyOn(useCases.products, "delete").mockResolvedValue({
      ok: true,
      data: undefined as never,
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getAllByText(/Luxury Shampoo/i).length).toBeGreaterThan(0)
    );
    fireEvent.click(screen.getAllByRole("button", { name: /^Delete$/i })[0]);
    // Confirm dialog appears (no silent delete).
    expect(await screen.findByText(/Are you sure you want to delete this product\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Confirm$/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("p1"));
  });
});
