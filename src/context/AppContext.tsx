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

  async function applySessionState(resolvedSessionState: SessionState, envError: Error | null) {
    setSessionState(resolvedSessionState);
    if (resolvedSessionState.status === "authenticated") {
      if (envError) throw envError; // Block Supabase login if misconfigured
      const userObj = resolvedSessionState.session.user;
      setUser(userObj);

      const centersRes = await useCases.auth.getMyCenters?.();
      if (centersRes && centersRes.ok && centersRes.data.length > 0) {
        const targetCenters = centersRes.data;

        if (config.branchMode === "single") {
          const hasMembership = targetCenters.some(c => c.id === config.centerId);
          if (!hasMembership) {
            const err = new Error("UNAUTHORIZED_CENTER_MEMBERSHIP");
            setSessionState({ status: "error", error: err });
            setUser(null);
            return;
          }
          localStorage.removeItem("activeCenterId");
        } else {
          let activeId = localStorage.getItem("activeCenterId");
          if (!activeId || !targetCenters.find(c => c.id === activeId)) {
            activeId = targetCenters[0].id;
          }
          useCases.tenant.setActiveCenterId(activeId);
          localStorage.setItem("activeCenterId", activeId);
        }
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
