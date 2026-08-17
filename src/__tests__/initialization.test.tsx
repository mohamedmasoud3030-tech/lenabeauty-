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
