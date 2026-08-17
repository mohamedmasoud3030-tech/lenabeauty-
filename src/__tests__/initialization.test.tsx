import { beforeEach, describe, it, expect, vi } from "vitest";
import { AppProvider, AppContext } from "../context/AppContext";
import { act, render, screen, waitFor } from "@testing-library/react";
import React, { useContext } from "react";
import { useCases } from "../app/composition/useCases";
import * as env from "../config/env";

const TestComponent = () => {
    const ctx = useContext(AppContext);
    if (!ctx) return null;
    return (
        <div>
            <div data-testid="initialized">{String(ctx.isInitialized)}</div>
            <div data-testid="status">{ctx.sessionState.status}</div>
            <button data-testid="retry" onClick={ctx.init}>Retry</button>
        </div>
    );
};

describe("Initialization Regression Tests", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(useCases.auth, "onAuthStateChange").mockReturnValue(() => {});
    });

    it("loading state clears after successful initialization", async () => {
        vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: true, data: { status: "anonymous" } });
        vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});

        render(<AppProvider><TestComponent /></AppProvider>);
        
        await waitFor(() => {
            expect(screen.getByTestId("initialized").textContent).toBe("true");
        });
        expect(screen.getByTestId("status").textContent).toBe("anonymous");
    });

    it("revalidates the session when Supabase auth state changes", async () => {
        let listener: ((event: string) => void) | undefined;
        const unsubscribe = vi.fn();
        vi.mocked(useCases.auth.onAuthStateChange).mockImplementation((callback) => {
            listener = callback;
            return unsubscribe;
        });
        const getSession = vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: true, data: { status: "anonymous" } });
        vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});

        const view = render(<AppProvider><TestComponent /></AppProvider>);
        await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
        act(() => listener?.("TOKEN_REFRESHED"));
        await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2));

        view.unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("does not restore a stale authenticated session after a newer sign-out event", async () => {
        let listener: ((event: string) => void) | undefined;
        let resolveMembership!: (value: any) => void;
        vi.mocked(useCases.auth.onAuthStateChange).mockImplementation((callback) => {
            listener = callback;
            return () => {};
        });
        vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});
        (env.config as any).centerId = "center-1";
        (env.config as any).branchMode = "single";
        vi.spyOn(useCases.auth, "getMyCenters").mockImplementation(
            () => new Promise((resolve) => { resolveMembership = resolve; }),
        );
        const authenticated = {
            status: "authenticated",
            session: {
                user: { id: "user-1", username: "admin@example.com", name: "Admin", role: "ADMIN" },
            },
        } as any;
        const getSession = vi.spyOn(useCases.auth, "getSession")
            .mockResolvedValueOnce({ ok: true, data: { status: "anonymous" } })
            .mockResolvedValueOnce({ ok: true, data: authenticated })
            .mockResolvedValueOnce({ ok: true, data: { status: "anonymous" } });

        render(<AppProvider><TestComponent /></AppProvider>);
        await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

        act(() => listener?.("TOKEN_REFRESHED"));
        await waitFor(() => expect(useCases.auth.getMyCenters).toHaveBeenCalledTimes(1));
        act(() => listener?.("SIGNED_OUT"));
        await waitFor(() => expect(getSession).toHaveBeenCalledTimes(3));
        await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));

        await act(async () => {
            resolveMembership({ ok: true, data: [{ id: "center-1", name: "Lena Beauty", role: "ADMIN" }] });
            await Promise.resolve();
        });
        expect(screen.getByTestId("status")).toHaveTextContent("anonymous");
    });

    it("loading state clears after failed initialization", async () => {
        vi.spyOn(useCases.auth, "getSession").mockResolvedValue({ ok: false, error: new Error("Test Error") as any });
        vi.spyOn(env, "validateEnvironment").mockImplementation(() => {});

        render(<AppProvider><TestComponent /></AppProvider>);
        
        await waitFor(() => {
            expect(screen.getByTestId("initialized").textContent).toBe("true");
        });
        expect(screen.getByTestId("status").textContent).toBe("error");
    });

    it("missing single-branch configuration produces a visible error", async () => {
        vi.spyOn(env, "validateEnvironment").mockImplementation(() => {
            throw new Error("VITE_CENTER_ID is missing");
        });

        render(<AppProvider><TestComponent /></AppProvider>);
        
        await waitFor(() => {
            expect(screen.getByTestId("initialized").textContent).toBe("true");
        });
        expect(screen.getByTestId("status").textContent).toBe("error");
    });
});
