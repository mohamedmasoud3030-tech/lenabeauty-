import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs } from "../shared/components/Tabs";
import { ConfirmProvider, useConfirm } from "../shared/components/ConfirmDialog";
import { ToastProvider, useToast } from "../shared/components/Toast";
import i18n from "../i18n";

function ConfirmHarness() {
  const { confirm } = useConfirm();
  return (
    <button type="button" onClick={() => void confirm({ title: "Delete", message: "Confirm deletion", type: "danger" })}>
      Open confirmation
    </button>
  );
}

function ToastHarness() {
  const { showToast } = useToast();
  return (
    <div>
      <button type="button" onClick={() => showToast("error", "Failed", "Try again")}>Error toast</button>
      <button type="button" onClick={() => showToast("success", "Saved")}>Success toast</button>
    </div>
  );
}

describe("shared accessibility foundation", () => {
  it("exposes tabs and supports arrow-key navigation in LTR and RTL", async () => {
    document.documentElement.dir = "ltr";
    render(
      <Tabs
        ariaLabel="Example sections"
        tabs={[
          { value: "first", label: "First", content: <p>First panel</p> },
          { value: "second", label: "Second", content: <p>Second panel</p> },
        ]}
      />,
    );

    const tablist = screen.getByRole("tablist", { name: "Example sections" });
    expect(tablist).toBeInTheDocument();
    const first = screen.getByRole("tab", { name: "First" });
    const second = screen.getByRole("tab", { name: "Second" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveAttribute("tabindex", "-1");

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Second");

    document.documentElement.dir = "rtl";
    fireEvent.keyDown(second, { key: "ArrowRight" });
    expect(first).toHaveFocus();
  });

  it("contains confirmation focus, starts on the safe action, and restores the trigger", async () => {
    render(<ConfirmProvider><ConfirmHarness /></ConfirmProvider>);
    const trigger = screen.getByRole("button", { name: "Open confirmation" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("alertdialog");
    const cancel = screen.getByRole("button", { name: i18n.t("Cancel") });
    await waitFor(() => expect(cancel).toHaveFocus());

    const confirm = screen.getByRole("button", { name: i18n.t("Confirm") });
    confirm.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("announces error and success toasts with translated close controls", async () => {
    await i18n.changeLanguage("ar");
    render(<ToastProvider><ToastHarness /></ToastProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Error toast" }));
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Failed");
    expect(error).toHaveAttribute("aria-live", "assertive");
    expect(screen.getByRole("button", { name: i18n.t("Close") })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Success toast" }));
    expect(await screen.findByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
