import React, { createContext, useContext, useEffect, useState } from "react";
import { useCases } from "../app/composition/useCases";
import { User, SessionState, UserRole } from "../domain/entities/Session";
import { config, validateEnvironment, EnvironmentConfigurationError } from "../config/env";

export interface AppContextType {
  isInitialized: boolean;
  user: User | null;
  sessionState: SessionState;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  init: () => Promise<void>;
  applyAuthenticatedSession: (sessionState: SessionState) => Promise<void>;
}

export const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>({ status: "loading" });
  const [user, setUser] = useState<User | null>(null);

  const CENTER_STORAGE_KEY = "lb_active_center_id";

  async function applySessionState(resolvedSessionState: SessionState, envError: Error | null) {
    setSessionState(resolvedSessionState);
    if (resolvedSessionState.status === "authenticated") {
      if (envError) throw envError; // Block Supabase login if misconfigured
      const userObj = resolvedSessionState.session.user;
      setUser(userObj);

      try {
        const centersRes = await useCases.auth.getMyCenters?.();
        const targetCenters = centersRes && centersRes.ok ? centersRes.data : [];

        // A session whose center membership cannot be verified (query error)
        // or that belongs to no center at all must NOT keep the app running:
        // every tenant-scoped query would fail anyway, so fail safe to Login
        // with a clear, translated message instead of a half-broken app.
        if (!centersRes || !centersRes.ok || targetCenters.length === 0) {
          const err = new Error("UNAUTHORIZED_CENTER_MEMBERSHIP");
          setSessionState({ status: "error", error: err });
          setUser(null);
          return;
        }

        if (config.branchMode === "single") {
          const hasMembership = targetCenters.some(c => c.id === config.centerId);
          if (!hasMembership) {
            const err = new Error("UNAUTHORIZED_CENTER_MEMBERSHIP");
            setSessionState({ status: "error", error: err });
            setUser(null);
            return;
          }
          try {
            localStorage.removeItem(CENTER_STORAGE_KEY);
          } catch { /* storage unavailable */ }
        } else {
          let activeId = localStorage.getItem(CENTER_STORAGE_KEY);
          if (!activeId || !targetCenters.find(c => c.id === activeId)) {
            activeId = targetCenters[0].id;
          }
          useCases.tenant.setActiveCenterId(activeId);
          try {
            localStorage.setItem(CENTER_STORAGE_KEY, activeId);
          } catch { /* storage unavailable */ }
        }
      } catch (error: any) {
        // Membership bootstrap crashed (e.g. network error) — never leave the
        // app half-initialized. Route safely to Login with a clear message.
        console.error("[AppContext] Center membership check failed:", error);
        const err = new Error("UNAUTHORIZED_CENTER_MEMBERSHIP");
        setSessionState({ status: "error", error: err });
        setUser(null);
        return;
      }
    } else {
      // unauthenticated
      if (envError) throw envError;
      setUser(null);
    }
  }

  function getEnvironmentError() {
    try {
      validateEnvironment(config);
      return null;
    } catch (e: any) {
      return e as Error;
    }
  }

  async function init() {
    try {
      const envError = getEnvironmentError();

      const res = await useCases.auth.getSession();
      if (res.ok) {
        await applySessionState(res.data, envError);
      } else {
        if (envError) throw envError;
        const errorRes = res as { ok: false; error: Error };
        setSessionState({ status: "error", error: errorRes.error });
        setUser(null);
      }
    } catch (error: any) {
      console.error("[AppContext] Initialization failed:", error);
      setSessionState({ status: "error", error: error as Error });
      setUser(null);
    } finally {
      setIsInitialized(true);
    }
  }

  async function applyAuthenticatedSession(nextSessionState: SessionState) {
    try {
      await applySessionState(nextSessionState, getEnvironmentError());
      setIsInitialized(true);
    } catch (error: any) {
      console.error("[AppContext] Login session application failed:", error);
      setSessionState({ status: "error", error: error as Error });
      setUser(null);
      setIsInitialized(true);
      throw error;
    }
  }

  useEffect(() => {
    void init();
  }, []);

  return (
    <AppContext.Provider value={{ isInitialized, sessionState, user, setUser, init, applyAuthenticatedSession }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
}
