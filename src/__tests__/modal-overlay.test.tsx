import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../shared/components/Modal";
import { ConfirmProvider } from "../shared/components/ConfirmDialog";
import i18n from "../i18n";

function renderModal(props: Partial<Parameters<typeof Modal>[0]> & { isOpen?: boolean }) {
  const onClose = vi.fn();
  render(
    <ConfirmProvider>
      <Modal
        isOpen={props.isOpen ?? true}
        onClose={onClose}
        title="Edit Product"
        footer={<button type="button">Save</button>}
        {...props}
      >
        <div>form body</div>
      </Modal>
    </ConfirmProvider>
  );
  return { onClose };
}

describe("Modal overlay architecture", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders into a portal above app chrome (z-index layer token) when open", () => {
    renderModal({});
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    // The overlay container uses the shared z-index layer token, not an
    // isolated arbitrary value, so it sits above header/sidebar/bottom-nav.
    const overlay = document.body.querySelector('[class*="z-[var(--z-overlay)]"]');
    expect(overlay).not.toBeNull();
  });

  it("does not render the dialog when closed", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks background scroll while open and restores it on close", () => {
    const { rerender } = render(
      <ConfirmProvider>
        <Modal isOpen onClose={() => {}} title="T">
          <div>body</div>
        </Modal>
      </ConfirmProvider>
    );
    expect(document.body.style.overflow).toBe("hidden");
    rerender(
      <ConfirmProvider>
        <Modal isOpen={false} onClose={() => {}} title="T">
          <div>body</div>
        </Modal>
      </ConfirmProvider>
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("closes on Escape and on the close button", () => {
    const { onClose } = renderModal({});
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes when the backdrop is clicked", () => {
    const { onClose } = renderModal({});
    // The backdrop is the first child of the overlay container.
    const overlay = document.body.querySelector('[class*="z-[var(--z-overlay)]"]') as HTMLElement;
    const backdrop = overlay.querySelector(".bg-black\\/50") as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the footer (primary actions) inside the dialog", () => {
    renderModal({});
    const dialog = screen.getByRole("dialog");
    const save = screen.getByRole("button", { name: "Save" });
    expect(dialog.contains(save)).toBe(true);
  });

  it("warns before closing when there are unsaved changes", async () => {
    const { onClose } = renderModal({ confirmCloseMessage: "Discard changes?" });
    // The confirmation prompt appears instead of closing immediately.
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Confirming the discard proceeds with the close.
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("dialog");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
