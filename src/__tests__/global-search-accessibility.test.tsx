import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { GlobalSearch } from "../shared/components/GlobalSearch";
import i18n from "../i18n";

const authState = { role: "STAFF" };

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}</output>;
}

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={["/customers"]}>
      <GlobalSearch userRole={authState.role} />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("global search navigation and permissions", () => {
  beforeEach(async () => {
    authState.role = "STAFF";
    await i18n.changeLanguage("en");
  });

  it("uses an accessible dialog, correct dashboard route, and restores focus", async () => {
    renderSearch();
    const trigger = screen.getByRole("button", { name: "Search" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
    const input = screen.getByRole("combobox", { name: "Search pages, actions..." });
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: "Dashboard" } });
    fireEvent.click(await screen.findByRole("option", { name: /Dashboard/ }));
    expect(screen.getByLabelText("Current path")).toHaveTextContent("/dashboard");
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("does not expose admin destinations to staff", async () => {
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const input = screen.getByRole("combobox", { name: "Search pages, actions..." });
    fireEvent.change(input, { target: { value: "Reports" } });
    expect(screen.queryByRole("option", { name: /Reports/ })).not.toBeInTheDocument();
    expect(screen.getByText(/No results found/).closest('[role="status"]')).toBeInTheDocument();
  });

  it("keeps admin destinations available to administrators", async () => {
    authState.role = "ADMIN";
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Reports" } });
    expect(await screen.findByRole("option", { name: /Reports/ })).toBeInTheDocument();
  });
});
