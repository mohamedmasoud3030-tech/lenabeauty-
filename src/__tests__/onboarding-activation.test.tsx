import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GettingStartedCard } from "../shared/components/GettingStartedCard";
import { useCases } from "../app/composition/useCases";
import { UserRole } from "../domain/entities/Session";
import { readActivationEvents } from "../shared/activation/events";
import { passwordResetRedirectUrl } from "../shared/auth/passwordResetRedirect";
import i18n from "../i18n";

describe("role-aware first-run guide", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await i18n.changeLanguage("en");
    vi.spyOn(useCases.services, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.employees, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.customers, "list").mockResolvedValue({ ok: true, data: [] } as any);
    vi.spyOn(useCases.appointments, "list").mockResolvedValue({ ok: true, data: [] } as any);
  });

  it("does not send staff to the admin-only employees page", async () => {
    render(
      <MemoryRouter>
        <GettingStartedCard viewerRole={UserRole.STAFF} />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Ask your administrator to add the team. You cannot open staff records.")).toBeInTheDocument();
    const team = screen.getByText("Add your team").closest("button");
    expect(team).toBeNull();
  });

  it("records an anonymous guide_shown event without personal data", async () => {
    render(
      <MemoryRouter>
        <GettingStartedCard viewerRole={UserRole.ADMIN} />
      </MemoryRouter>,
    );
    await screen.findByText("Set up your center");
    await waitFor(() => expect(readActivationEvents().some((e) => e.name === "guide_shown")).toBe(true));
    const payload = JSON.stringify(readActivationEvents());
    expect(payload).not.toMatch(/@/);
    expect(payload).not.toMatch(/\+?\d{8,}/);
  });
});

describe("activation recovery surfaces", () => {
  it("keeps password-reset return on the hash router", () => {
    expect(passwordResetRedirectUrl({ origin: "https://demo.example", pathname: "/" })).toContain("#/reset-password");
  });
});
